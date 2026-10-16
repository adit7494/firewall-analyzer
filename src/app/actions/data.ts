'use server'

import prisma from "@/lib/db/prisma"
import { Company, Device, AuditResult, Finding, Report, FindingStatus, AuditGrade } from "@/lib/types/audit"
import { ScoringEngine } from "@/lib/engine/scoring-engine"

export async function getCompanies(): Promise<Company[]> {
  const comps = await prisma.company.findMany()
  return comps.map((c: any) => ({
    ...c,
    created_at: c.created_at.toISOString()
  })) as any
}

export async function getCompanyById(id: string) {
  const c = await prisma.company.findUnique({ where: { id } })
  if (!c) return null
  return {
    ...c,
    created_at: c.created_at.toISOString()
  } as any
}

export async function addCompany(data: Omit<Company, 'id' | 'created_at'>) {
  return await prisma.company.create({
    data: {
      name: data.name,
      contact_person: data.contact_person,
      contact_email: data.contact_email,
      industry: data.industry,
      notes: data.notes,
      avatar_initials: data.avatar_initials,
      devices_count: data.devices_count,
      latest_score: data.latest_score,
      latest_grade: data.latest_grade,
      open_findings_count: data.open_findings_count,
    }
  })
}

export async function deleteCompany(id: string) {
  // SQLite Prisma cascade fallback
  await prisma.report.deleteMany({ where: { company_id: id } });
  await prisma.auditFrameworkResult.deleteMany({ where: { audit: { company_id: id } } });
  await prisma.audit.deleteMany({ where: { company_id: id } });
  await prisma.device.deleteMany({ where: { company_id: id } });

  return await prisma.company.delete({
    where: { id }
  })
}

export async function updateCompany(id: string, data: Partial<Company>) {
  return await prisma.company.update({
    where: { id },
    data
  })
}

export async function getDevices(): Promise<Device[]> {
  const devs = await prisma.device.findMany()
  return devs as any
}

export async function getDevicesByCompany(company_id: string): Promise<Device[]> {
  const devs = await prisma.device.findMany({ where: { company_id } })
  return devs as any
}

export async function addDevice(data: Omit<Device, 'id'>) {
  return await prisma.device.create({
    data: {
      company_id: data.company_id,
      vendor: data.vendor,
      model: data.model,
      os_version: data.os_version,
      hostname: data.hostname,
      serial: data.serial,
      ha_status: data.ha_status,
      location: data.location,
      last_backup_date: data.last_backup_date,
      last_audit_date: data.last_audit_date,
      latest_score: data.latest_score,
      latest_grade: data.latest_grade,
    }
  })
}

export async function updateDevice(id: string, data: Partial<Device>) {
  return await prisma.device.update({
    where: { id },
    data: {
      last_audit_date: data.last_audit_date,
      latest_score: data.latest_score,
      latest_grade: data.latest_grade
    }
  })
}

export async function deleteDevice(id: string) {
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) return;
  const companyId = device.company_id;
  
  // SQLite Prisma cascade fallback for device audits
  await prisma.auditFrameworkResult.deleteMany({ where: { audit: { device_id: id } } });
  await prisma.audit.deleteMany({ where: { device_id: id } });
  
  // Delete device
  await prisma.device.delete({ where: { id } });

  // Recalculate company devices count and average score
  const allDevices = await prisma.device.findMany({ where: { company_id: companyId } })
  const devicesWithScore = allDevices.filter(d => d.latest_score !== null && d.latest_score !== undefined)
  const totalScore = devicesWithScore.reduce((acc, curr) => acc + (curr.latest_score || 0), 0)
  const avgScore = devicesWithScore.length > 0 ? Math.round(totalScore / devicesWithScore.length) : 0
  const avgGrade = avgScore >= 90 ? 'A' : avgScore >= 80 ? 'B' : avgScore >= 70 ? 'C' : avgScore >= 60 ? 'D' : 'F'

  await prisma.company.update({
    where: { id: companyId },
    data: {
      latest_score: avgScore,
      latest_grade: avgGrade,
      devices_count: allDevices.length
    }
  })
}

export async function getAudits(): Promise<AuditResult[]> {
  const audits = await prisma.audit.findMany({ orderBy: { created_at: 'desc' } })
  return audits.map((a: any) => {
    try {
      const parsed = JSON.parse(a.data);
      return {
        ...parsed,
        status: a.status || parsed.status,
        score: a.score ?? parsed.score,
        grade: a.grade || parsed.grade,
      };
    } catch {
      return a as any;
    }
  })
}

export async function getAuditsByCompany(company_id: string): Promise<AuditResult[]> {
  const audits = await prisma.audit.findMany({ where: { company_id }, orderBy: { created_at: 'desc' } })
  return audits.map((a: any) => {
    try {
      const parsed = JSON.parse(a.data);
      return {
        ...parsed,
        status: a.status || parsed.status,
        score: a.score ?? parsed.score,
        grade: a.grade || parsed.grade,
      };
    } catch {
      return a as any;
    }
  })
}

export async function getAuditById(id: string): Promise<AuditResult | null> {
  const a = await prisma.audit.findUnique({ where: { id } })
  if (!a) return null
  try {
    const parsed = JSON.parse(a.data);
    return {
      ...parsed,
      status: a.status || parsed.status,
      score: a.score ?? parsed.score,
      grade: a.grade || parsed.grade,
    };
  } catch {
    return a as any;
  }
}

export async function saveAudit(audit: AuditResult) {
  const existing = await prisma.audit.findUnique({ where: { id: audit.id } })
  
  if (existing) {
    return await prisma.audit.update({
      where: { id: audit.id },
      data: {
        status: audit.status,
        score: audit.score,
        grade: audit.grade,
        data: JSON.stringify(audit)
      }
    })
  } else {
    return await prisma.audit.create({
      data: {
        id: audit.id,
        company_id: audit.company_id,
        device_id: audit.device_id,
        status: audit.status,
        score: audit.score,
        grade: audit.grade,
        data: JSON.stringify(audit)
      }
    })
  }
}

export async function finalizeAuditMetadata(auditId: string, companyId: string, deviceId: string, parsedDevice: any, score: number, grade: AuditGrade) {
  // Update Device
  await prisma.device.update({
    where: { id: deviceId },
    data: {
      hostname: parsedDevice?.hostname || undefined,
      model: parsedDevice?.model || undefined,
      os_version: parsedDevice?.os_version || undefined,
      serial: parsedDevice?.serial || undefined,
      ha_status: parsedDevice?.ha_status || undefined,
      last_audit_date: new Date().toISOString().split('T')[0],
      latest_score: score,
      latest_grade: grade
    }
  })

  // Update Company (Calculate average score of all devices for the company)
  const allDevices = await prisma.device.findMany({ where: { company_id: companyId } })
  const devicesWithScore = allDevices.filter(d => d.latest_score !== null && d.latest_score !== undefined)
  const totalScore = devicesWithScore.reduce((acc, curr) => acc + (curr.latest_score || 0), 0)
  const avgScore = devicesWithScore.length > 0 ? Math.round(totalScore / devicesWithScore.length) : score
  const avgGrade: AuditGrade = avgScore >= 90 ? 'A' : avgScore >= 80 ? 'B' : avgScore >= 70 ? 'C' : avgScore >= 60 ? 'D' : 'F'

  await prisma.company.update({
    where: { id: companyId },
    data: {
      latest_score: avgScore,
      latest_grade: avgGrade,
      devices_count: allDevices.length
    }
  })
}

export async function getReports(): Promise<Report[]> {
  const reports = await prisma.report.findMany({ orderBy: { created_at: 'desc' } })
  return reports.map((r: any) => ({
    ...r,
    created_at: r.created_at.toISOString(),
    snapshot: r.snapshot ? JSON.parse(r.snapshot) : undefined
  })) as any
}

export async function getReportById(id: string) {
  const r = await prisma.report.findUnique({ where: { id } })
  if (!r) return null
  return {
    ...r,
    created_at: r.created_at.toISOString(),
    snapshot: r.snapshot ? JSON.parse(r.snapshot) : undefined
  } as any
}

export async function addReport(report: Report) {
  return await prisma.report.create({
    data: {
      id: report.id,
      audit_id: report.audit_id,
      company_id: report.company_id,
      company_name: report.company_name,
      device_name: report.device_name,
      type: report.type,
      score: report.score,
      grade: report.grade,
      finalized: report.finalized,
      snapshot: report.snapshot ? JSON.stringify(report.snapshot) : null
    }
  })
}

export async function deleteReport(id: string) {
  return await prisma.report.delete({
    where: { id }
  })
}

export async function updateFindingStatus(auditId: string, findingId: string, status: FindingStatus, note?: string) {
  const existing = await prisma.audit.findUnique({ where: { id: auditId } })
  if (!existing) return null

  const audit: AuditResult = JSON.parse(existing.data)
  const findingIdx = audit.findings.findIndex(f => f.id === findingId)
  if (findingIdx < 0) return null

  audit.findings[findingIdx].status = status
  if (note !== undefined) {
    audit.findings[findingIdx].auditor_note = note
  }

  const res = ScoringEngine.calculateScore(audit.findings)
  audit.score = res.score
  audit.grade = res.grade
  audit.breakdown = res.breakdown
  audit.score_breakdown = res.score_breakdown

  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status: audit.status,
      score: audit.score,
      grade: audit.grade,
      data: JSON.stringify(audit)
    }
  })
  
  return audit
}

export async function addManualFinding(auditId: string, finding: Omit<Finding, 'id' | 'audit_id' | 'created_at'>) {
  const existing = await prisma.audit.findUnique({ where: { id: auditId } })
  if (!existing) return null

  const audit: AuditResult = JSON.parse(existing.data)
  const newFinding: Finding = {
    ...finding,
    id: `MANUAL_${Math.random().toString(36).substring(2, 7)}`,
    audit_id: auditId,
    created_at: new Date().toISOString()
  }
  audit.findings.push(newFinding)

  const res = ScoringEngine.calculateScore(audit.findings)
  audit.score = res.score
  audit.grade = res.grade
  audit.breakdown = res.breakdown
  audit.score_breakdown = res.score_breakdown

  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status: audit.status,
      score: audit.score,
      grade: audit.grade,
      data: JSON.stringify(audit)
    }
  })
  
  return audit
}
