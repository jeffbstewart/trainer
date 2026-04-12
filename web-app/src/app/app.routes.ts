import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { setupGuard } from './core/setup.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then(m => m.LoginComponent),
  },
  {
    path: 'setup',
    canActivate: [setupGuard],
    loadComponent: () => import('./features/auth/setup').then(m => m.SetupComponent),
  },
  {
    path: 'accept-legal',
    canActivate: [authGuard],
    loadComponent: () => import('./features/auth/accept-legal').then(m => m.AcceptLegalComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/shell/shell').then(m => m.ShellComponent),
    children: [
      { path: '', loadComponent: () => import('./features/home/home').then(m => m.HomeComponent) },
      { path: 'profile', loadComponent: () => import('./features/profile/profile').then(m => m.ProfileComponent) },
      { path: 'users', loadComponent: () => import('./features/users/users').then(m => m.UsersComponent) },
      { path: 'users/:userId', loadComponent: () => import('./features/users/user-detail').then(m => m.UserDetailComponent) },
      { path: 'targets', loadComponent: () => import('./features/targets/targets').then(m => m.TargetsComponent) },
      { path: 'targets/:targetId', loadComponent: () => import('./features/targets/target-detail').then(m => m.TargetDetailComponent) },
      { path: 'exercises', loadComponent: () => import('./features/exercises/exercises').then(m => m.ExercisesComponent) },
      { path: 'exercises/:exerciseId', loadComponent: () => import('./features/exercises/exercise-detail').then(m => m.ExerciseDetailComponent) },
      { path: 'equipment', loadComponent: () => import('./features/equipment/equipment').then(m => m.EquipmentComponent) },
      { path: 'equipment/:equipmentId', loadComponent: () => import('./features/equipment/equipment-detail').then(m => m.EquipmentDetailComponent) },
      { path: 'programs', loadComponent: () => import('./features/programs/programs').then(m => m.ProgramsComponent) },
      { path: 'programs/:programId', loadComponent: () => import('./features/programs/program-detail').then(m => m.ProgramDetailComponent) },
      { path: 'programs/:programId/workout/:workoutId', loadComponent: () => import('./features/programs/program-detail').then(m => m.ProgramDetailComponent) },
    ],
  },
];
