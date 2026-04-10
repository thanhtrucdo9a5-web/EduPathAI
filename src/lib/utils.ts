import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth } from '../firebase';
import { UserProfile, Major } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function calculateAdmissionProbability(profile: UserProfile, major: Major): number {
  let probability = 50; // Base probability
  const lastScore = major.admissionScore['2024'] || 20;
  
  // GPA Factor
  if (profile.academicRecord?.gpa) {
    const gpa = profile.academicRecord.gpa;
    const targetGpa = lastScore > 27 ? 9.0 : lastScore > 24 ? 8.5 : 8.0;
    if (gpa >= targetGpa) probability += 15;
    else if (gpa >= targetGpa - 0.5) probability += 5;
    else probability -= 10;
  }

  // Competency Score Factor
  if (profile.academicRecord?.competencyScore) {
    const cs = profile.academicRecord.competencyScore;
    // Normalize to 1200 scale for estimation
    const normalizedCs = cs <= 150 ? (cs / 150) * 1200 : cs;
    const targetCs = lastScore > 27 ? 950 : lastScore > 24 ? 850 : 750;
    if (normalizedCs >= targetCs) probability += 20;
    else if (normalizedCs >= targetCs - 100) probability += 10;
    else probability -= 15;
  }

  // Certificates Factor
  if (profile.academicRecord?.certificates && profile.academicRecord.certificates.length > 0) {
    const certs = profile.academicRecord.certificates.join(' ').toLowerCase();
    if (certs.includes('ielts') || certs.includes('hsk') || certs.includes('jlpt')) {
      probability += 10;
    }
  }

  return Math.max(5, Math.min(95, probability));
}

export function getRegion(location: string): string {
  const loc = location.toLowerCase();
  if (loc.includes('hà nội') || loc.includes('hải phòng') || loc.includes('thái nguyên') || loc.includes('nam định') || loc.includes('hưng yên') || loc.includes('phú thọ') || loc.includes('bắc giang')) return 'miền Bắc';
  if (loc.includes('đà nẵng') || loc.includes('huế') || loc.includes('vinh') || loc.includes('nghệ an') || loc.includes('quy nhơn') || loc.includes('buôn ma thuột') || loc.includes('đà lạt')) return 'miền Trung';
  if (loc.includes('tp.hcm') || loc.includes('hồ chí minh') || loc.includes('cần thơ') || loc.includes('bình dương') || loc.includes('đồng nai')) return 'miền Nam';
  return '';
}
