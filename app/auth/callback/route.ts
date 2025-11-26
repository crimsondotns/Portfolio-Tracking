import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  // 1. Log เริ่มต้น: บอกว่ามี Request เข้ามาที่ห้องรับแขกแล้ว
  console.log("🟢 Auth Callback triggered")
  
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const error_description = searchParams.get('error_description') // เผื่อ Supabase ส่ง error มาใน URL โดยตรง

  // Log สิ่งที่ได้รับมา
  console.log(`🔍 Params received - Code: ${code ? "Yes" : "No"}, Next: ${next}`)
  
  if (error_description) {
      console.error("🚨 Supabase returned error in URL:", error_description)
      return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error_description)}`)
  }

  if (code) {
    const cookieStore = await cookies()
    
    // สร้าง Client สำหรับ Server
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    // 2. Log ก่อนแลกบัตร: กำลังจะเอา Code ไปแลก Session
    console.log("🔄 Exchanging code for session...")

    try {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        
        if (!error) {
          // 3. Log สำเร็จ: แลกบัตรผ่านแล้ว
          console.log("✅ Session exchange successful! Redirecting to:", next)
          
          const forwardedHost = request.headers.get('x-forwarded-host') // เผื่อกรณีอยู่หลัง Proxy
          const isLocalEnv = process.env.NODE_ENV === 'development'
          
          if (isLocalEnv) {
            // กรณี Localhost
            return NextResponse.redirect(`${origin}${next}?login=success`)
          } else if (forwardedHost) {
            // กรณี Vercel Production (ใช้ URL จริงที่ User เข้ามา)
            return NextResponse.redirect(`https://${forwardedHost}${next}?login=success`)
          } else {
            // Fallback ทั่วไป
            return NextResponse.redirect(`${origin}${next}?login=success`)
          }

        } else {
          // 4. Log Error จาก Supabase (สำคัญมาก!)
          console.error("❌ Exchange Error:", error.message)
          console.error("❌ Full Error Object:", JSON.stringify(error, null, 2))
          
          return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error.message)}`)
        }
    } catch (err) {
        // 5. Log Error ที่คาดไม่ถึง (เช่น Code พัง)
        console.error("🔥 Unexpected Error during exchange:", err)
        return NextResponse.redirect(`${origin}/?error=unexpected_error`)
    }
  }

  // กรณีไม่มี Code ส่งมา
  console.warn("⚠️ No code provided in callback URL")
  return NextResponse.redirect(`${origin}/?error=no_code_provided`)
}