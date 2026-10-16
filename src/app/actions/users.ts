'use server'

import prisma from "@/lib/db/prisma"
import bcrypt from "bcryptjs"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function getUsers() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    throw new Error("Unauthorized")
  }
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  })
  
  return users
}

export async function createUser(email: string, passwordRaw: string, role: string = 'admin') {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    throw new Error("Unauthorized")
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { error: "User already exists." }
  }

  const hashedPassword = await bcrypt.hash(passwordRaw, 10)

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role,
      mustChangePassword: true, // Forces new users to change on first login
    }
  })

  return { success: true }
}
