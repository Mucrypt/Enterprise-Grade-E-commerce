'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      await login(data.email, data.password)
      router.push('/dashboard')
    } catch (error: any) {
      // AuthContext already handles toasts; keep this catch to stop the spinner.
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4'>
      <Card className='w-full max-w-md shadow-2xl'>
        <CardHeader className='space-y-2 text-center'>
          <div className='mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-2'>
            <ShieldCheck className='w-10 h-10 text-white' />
          </div>
          <CardTitle className='text-3xl font-bold'>TechTools Admin</CardTitle>
          <CardDescription className='text-base'>
            Sign in to access the admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='email'>Email Address</Label>
              <Input
                id='email'
                type='email'
                placeholder='admin@techtools.com'
                {...register('email')}
                disabled={isLoading}
                className='h-11'
              />
              {errors.email && (
                <p className='text-sm text-red-600'>{errors.email.message}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='password'>Password</Label>
              <div className='relative'>
                <Input
                  id='password'
                  type={showPassword ? 'text' : 'password'}
                  placeholder='••••••••'
                  {...register('password')}
                  disabled={isLoading}
                  className='h-11 pr-10'
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700'
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className='w-5 h-5' />
                  ) : (
                    <Eye className='w-5 h-5' />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className='text-sm text-red-600'>
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type='submit'
              className='w-full h-11 text-base font-semibold'
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className='w-5 h-5 mr-2 animate-spin' />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className='mt-6 pt-6 border-t text-center text-sm text-gray-600'>
            <p className='font-medium'>🔒 Secure Admin Access</p>
            <p className='mt-1 text-xs'>Super Admin & Admin roles only</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
