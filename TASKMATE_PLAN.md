# TaskMate - Shared Household Task Management App
## Streamlined MVP Development Plan

### 🎯 Project Overview (Updated)

TaskMate is a **free** mobile application for shared household task management among friends and roommates. Focus on rapid development with core features, gamification, and bilingual support.

**Simplified Requirements:**
- ✅ Free app only (no monetization)
- ✅ No household size limits
- ✅ One-time and recurring tasks
- ✅ Gamification with streaks and leaderboards
- ✅ Admin features for household management
- ✅ French and English language support
- ✅ Online-only (no offline functionality)
- ✅ Simple push notifications
- ✅ Quick MVP implementation

### 🏗️ Simplified Tech Stack

**Frontend:**
- **Expo (React Native)** - Cross-platform development
- **TypeScript** - Type safety
- **Tamagui** - UI components
- **Zustand** - State management
- **TanStack React Query** - Data fetching
- **expo-localization + i18next** - Internationalization
- **Expo Notifications** - Push notifications

**Backend:**
- **Supabase** - Complete backend solution
- **PostgreSQL** - Database
- **Supabase Auth** - Authentication
- **Supabase Realtime** - Real-time updates

### 🗄️ Simplified Database Schema

```sql
-- Households table
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    household_id UUID REFERENCES households(id),
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    current_streak INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks (both recurring and one-time)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID REFERENCES households(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    is_recurring BOOLEAN DEFAULT TRUE,
    frequency_type TEXT CHECK (frequency_type IN ('daily', 'weekly', 'monthly')),
    frequency_value INTEGER DEFAULT 1,
    points_value INTEGER DEFAULT 10,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task assignments
CREATE TABLE task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) NOT NULL,
    assigned_to UUID REFERENCES profiles(id) NOT NULL,
    due_date DATE NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES profiles(id),
    rotation_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task participants for rotation
CREATE TABLE task_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    rotation_order INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(task_id, user_id)
);
```

### 🎮 Gamification System

```typescript
// Streak and points calculation
interface UserStats {
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
  completedTasks: number;
}

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  weeklyPoints: number;
  monthlyPoints: number;
  currentStreak: number;
  rank: number;
}

// Points system
- Task completion: 10 points base
- Streak bonus: +5 points per day in streak
- Early completion: +2 points if completed early
- Difficult task bonus: +5 points for tasks with long duration
```

### 🌍 Internationalization Setup

```typescript
// i18next configuration
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

const resources = {
  en: {
    translation: {
      // Task-related
      "tasks.create": "Create Task",
      "tasks.complete": "Complete Task",
      "tasks.due_today": "Due Today",
      "tasks.overdue": "Overdue",
      
      // Gamification
      "gamification.streak": "Current Streak",
      "gamification.points": "Points",
      "gamification.leaderboard": "Leaderboard",
      
      // Notifications
      "notifications.task_due": "{{taskName}} is due!",
      "notifications.task_overdue": "{{taskName}} is overdue"
    }
  },
  fr: {
    translation: {
      // Task-related
      "tasks.create": "Créer une Tâche",
      "tasks.complete": "Terminer la Tâche",
      "tasks.due_today": "À Faire Aujourd'hui",
      "tasks.overdue": "En Retard",
      
      // Gamification
      "gamification.streak": "Série Actuelle",
      "gamification.points": "Points",
      "gamification.leaderboard": "Classement",
      
      // Notifications
      "notifications.task_due": "{{taskName}} est à faire !",
      "notifications.task_overdue": "{{taskName}} est en retard"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: Localization.locale.split('-')[0],
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });
```

### 👑 Admin Features

```typescript
interface AdminFeatures {
  // Household management
  editHouseholdSettings: boolean;
  generateInviteCode: boolean;
  removeMembers: boolean;
  
  // Task management
  createGlobalTasks: boolean;
  editAllTasks: boolean;
  deleteAllTasks: boolean;
  reassignTasks: boolean;
  
  // User management
  promoteToAdmin: boolean;
  resetUserStats: boolean;
  manageUserRoles: boolean;
}

// Admin-only functions
- Edit household name and settings
- Generate new invite codes
- Remove household members
- Create tasks for all members
- Reassign tasks manually
- Reset user statistics
- Promote members to admin
```

### 📱 Simplified Screen Structure

1. **Authentication**
   - Welcome screen
   - Login/Signup
   - Household creation/joining

2. **Main App (Bottom Tabs)**
   - **Dashboard** - Today's tasks, streaks, quick stats
   - **Tasks** - All tasks, create new, task details
   - **Leaderboard** - Household rankings and achievements
   - **Profile** - User settings, language selection

3. **Admin Screens** (conditional)
   - Household management
   - User management
   - Task management

### 🔔 Simplified Notification System

```typescript
// Simple notification implementation
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';

async function scheduleTaskNotification(assignment: TaskAssignment, task: Task) {
  const { t } = useTranslation();
  
  // Schedule notification for task due date
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notifications.task_due', { taskName: task.title }),
      body: task.description || t('tasks.tap_to_complete'),
      data: { taskAssignmentId: assignment.id, taskId: task.id },
    },
    trigger: {
      date: new Date(assignment.dueDate),
    },
  });
}

// Escalation reminders (simple)
async function scheduleReminderNotifications(assignment: TaskAssignment, task: Task) {
  const { t } = useTranslation();
  
  // 2 hours after due
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notifications.task_overdue', { taskName: task.title }),
      body: task.description || t('tasks.please_complete'),
      data: { taskAssignmentId: assignment.id, taskId: task.id },
    },
    trigger: {
      date: new Date(assignment.dueDate.getTime() + 2 * 60 * 60 * 1000),
    },
  });
}
```

### 🚀 Rapid Development Timeline (4-5 weeks)

#### Week 1: Foundation
- ✅ Set up Expo project with TypeScript
- ✅ Configure Supabase project and database
- ✅ Implement authentication system
- ✅ Create basic UI components with Tamagui
- ✅ Set up i18next for French/English

#### Week 2: Core Features
- ✅ Build task CRUD operations
- ✅ Implement task assignment and rotation
- ✅ Create dashboard with basic stats
- ✅ Add task completion functionality

#### Week 3: Gamification & Admin
- ✅ Implement points and streak system
- ✅ Build leaderboard functionality
- ✅ Add admin features for household management
- ✅ Create user management interface

#### Week 4: Polish & Notifications
- ✅ Implement push notifications
- ✅ Add real-time updates
- ✅ Polish UI/UX
- ✅ Test on iOS and Android

#### Week 5: Launch
- ✅ Final testing and bug fixes
- ✅ Deploy to app stores (TestFlight/Play Console)
- ✅ Share with friends for testing

### 💡 Quick Implementation Tips

**Use Expo's managed workflow** for fastest development
**Leverage Supabase's built-in features** instead of custom solutions
**Keep UI simple** - focus on functionality over complex animations
**Use Tamagui's pre-built components** to speed up development
**Test early and often** on both iOS and Android
**Start with English**, add French translations later

### 🎯 MVP Feature Checklist

**Core Features:**
- [x] User authentication and household management
- [x] Task creation (one-time and recurring)
- [x] Task assignment and rotation
- [ ] Task completion with points
- [ ] Streak tracking and leaderboard
- [ ] Push notifications
- [ ] Admin features
- [ ] Bilingual support (EN/FR)

**Nice-to-Have (Post-MVP):**
- [ ] Task categories and filters
- [ ] Advanced statistics and charts
- [ ] Achievement badges
- [ ] Profile customization
- [ ] Export household data

This streamlined plan focuses on rapid development while keeping all your core requirements. Ready to start building? 