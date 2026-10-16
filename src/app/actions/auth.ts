'use server'

import prisma from "@/lib/db/prisma"
import bcrypt from "bcryptjs"

export async function hasAnyUser() {
  const count = await prisma.user.count()
  return count > 0
}

export async function createFirstAdmin(email: string, passwordRaw: string) {
  const count = await prisma.user.count()
  if (count > 0) {
    return { error: "Admin already exists." }
  }

  const hashedPassword = await bcrypt.hash(passwordRaw, 10)

  const admin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'admin',
      mustChangePassword: false, // First admin knows their password
    }
  })

  return { success: true }
}
