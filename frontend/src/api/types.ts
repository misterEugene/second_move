export type Role = 'VOLUNTEER' | 'ORGANIZER' | 'ADMIN';
export type Category = 'SOCIAL' | 'ECOLOGY' | 'EDUCATION' | 'HEALTH' | 'CULTURE' | 'SPORT' | 'ANIMALS';
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface Shift {
  id: number;
  startAt: string;
  endAt: string;
  capacity: number;
  taken?: number;
}

export interface EventItem {
  id: number;
  title: string;
  description: string;
  requirements: string;
  category: Category;
  date: string;
  city: string;
  address: string;
  limit: number;
  imageUrl: string | null;
  status: 'PUBLISHED' | 'HIDDEN';
  createdAt: string;
  organization: { id: number; name: string };
  skills: string[];
  approvedCount: number;
  freePlaces: number;
  shifts: Shift[];
}

export interface EventDetails extends EventItem {
  organizationRating: { average: number | null; count: number };
  canManage: boolean;
  myApplications: {
    id: number;
    status: ApplicationStatus;
    shiftId: number | null;
    attended: boolean | null;
    hours: number | null;
  }[];
  myReview: { rating: number; text: string } | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Rating {
  average: number | null;
  count: number;
}

export interface ReviewItem {
  id: number;
  rating: number;
  text: string;
  createdAt: string;
  author: string;
  event: { id: number; title: string };
}

export interface MyApplication {
  id: number;
  status: ApplicationStatus;
  message: string;
  createdAt: string;
  event: Pick<EventItem, 'id' | 'title' | 'date' | 'city' | 'address' | 'category' | 'imageUrl' | 'organization'> & {
    shifts: Shift[];
  };
  shift: Shift | null;
  attended: boolean | null;
  hours: number | null;
  hoursConfirmedAt: string | null;
  canReview: boolean;
  reviewed: boolean;
}

export interface Statistics {
  totalHours: number;
  eventsCount: number;
  byCategory: { category: Category; hours: number }[];
  applications: Partial<Record<ApplicationStatus, number>>;
  history: { event: { id: number; title: string; category: Category; date: string }; hours: number; confirmedAt: string }[];
  upcoming: { applicationId: number; event: { id: number; title: string; city: string; address: string; category: Category }; shift: Shift }[];
}

export interface EventApplication {
  id: number;
  status: ApplicationStatus;
  message: string;
  createdAt: string;
  volunteer: { id: number; name: string; email: string; city: string | null };
  shift: Shift | null;
  participation: { id: number; attended: boolean; markedAt: string; hours: number | null; confirmedAt: string | null } | null;
}

export interface NotificationItem {
  id: number;
  text: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}
