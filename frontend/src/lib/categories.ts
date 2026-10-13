import { Bike, BookOpen, HandHeart, HeartPulse, Leaf, PawPrint, Sparkles, type LucideIcon } from 'lucide-react';
import type { ApplicationStatus, Category } from '@/api/types';

interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  color: string;
  tint: string;
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  EDUCATION: { label: 'Образование', icon: BookOpen, color: '#2a78d6', tint: '#e8f1fb' },
  HEALTH: { label: 'Здоровье', icon: HeartPulse, color: '#eb6834', tint: '#fdeee7' },
  SOCIAL: { label: 'Социальная помощь', icon: HandHeart, color: '#1baf7a', tint: '#e5f6ef' },
  SPORT: { label: 'Спорт', icon: Bike, color: '#eda100', tint: '#fdf4dd' },
  ANIMALS: { label: 'Животные', icon: PawPrint, color: '#e87ba4', tint: '#fcedf3' },
  ECOLOGY: { label: 'Экология', icon: Leaf, color: '#008300', tint: '#e3f2e3' },
  CULTURE: { label: 'Культура и события', icon: Sparkles, color: '#6250d6', tint: '#eeecfb' },
};

export const CATEGORY_ORDER = Object.keys(CATEGORIES) as Category[];

export const STATUS: Record<ApplicationStatus, { label: string; tone: 'warn' | 'ok' | 'bad' | 'muted' }> = {
  PENDING: { label: 'Ожидает', tone: 'warn' },
  APPROVED: { label: 'Одобрена', tone: 'ok' },
  REJECTED: { label: 'Отклонена', tone: 'bad' },
  CANCELLED: { label: 'Отменена', tone: 'muted' },
};

export const ROLE_LABEL = { VOLUNTEER: 'Волонтёр', ORGANIZER: 'Организатор', ADMIN: 'Администратор' } as const;
