import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/Layout';
import { GuestOnly, RequireRole } from '@/components/RequireRole';
import { AuthProvider } from '@/lib/auth';
import { AdminPage } from '@/pages/admin/AdminPage';
import { ApplicationsPage } from '@/pages/cabinet/ApplicationsPage';
import { CabinetLayout } from '@/pages/cabinet/CabinetLayout';
import { DashboardPage } from '@/pages/cabinet/DashboardPage';
import { HoursPage } from '@/pages/cabinet/HoursPage';
import { ProfilePage } from '@/pages/cabinet/ProfilePage';
import { EventPage } from '@/pages/EventPage';
import { EventsPage } from '@/pages/EventsPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage, RegisterPage } from '@/pages/AuthPages';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { OrganizationPage, OrganizationsPage } from '@/pages/OrganizationsPages';
import { EventFormPage } from '@/pages/organizer/EventFormPage';
import { ManageEventPage } from '@/pages/organizer/ManageEventPage';
import { OrgEventsPage } from '@/pages/organizer/OrgEventsPage';
import { OrganizerLayout } from '@/pages/organizer/OrganizerLayout';
import { OrgProfilePage, OrgReviewsPage } from '@/pages/organizer/OrgPages';
import './main.css';
import './components.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="events/:id" element={<EventPage />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="organizations/:id" element={<OrganizationPage />} />
            <Route path="login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
            <Route path="notifications" element={<RequireRole><NotificationsPage /></RequireRole>} />
            <Route path="cabinet" element={<RequireRole roles={['VOLUNTEER', 'ADMIN']}><CabinetLayout /></RequireRole>}>
              <Route index element={<DashboardPage />} />
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="hours" element={<HoursPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path="organizer" element={<RequireRole roles={['ORGANIZER', 'ADMIN']}><OrganizerLayout /></RequireRole>}>
              <Route index element={<RequireRole roles={['ORGANIZER']}><OrgEventsPage /></RequireRole>} />
              <Route path="events/new" element={<EventFormPage />} />
              <Route path="events/:id" element={<ManageEventPage />} />
              <Route path="events/:id/edit" element={<EventFormPage />} />
              <Route path="reviews" element={<RequireRole roles={['ORGANIZER']}><OrgReviewsPage /></RequireRole>} />
              <Route path="organization" element={<RequireRole roles={['ORGANIZER']}><OrgProfilePage /></RequireRole>} />
            </Route>
            <Route path="admin" element={<RequireRole roles={['ADMIN']}><AdminPage /></RequireRole>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
