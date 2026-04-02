import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

interface Ref { id: number; name: string; }
interface ExerciseForTarget {
  id: number; name: string; difficulty: string; equipment: Ref[];
}
interface TargetDetail {
  id: number; name: string; category: string;
}

@Component({
  selector: 'app-target-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatChipsModule],
  template: `
    @if (target(); as t) {
      <div class="back-row">
        <a mat-button routerLink="/targets"><mat-icon>arrow_back</mat-icon> All Targets</a>
      </div>

      <h2>{{ t.name }}</h2>
      <span class="category-label">{{ categoryLabel(t.category) }}</span>

      <h3>Exercises ({{ exercises().length }})</h3>
      @if (exercises().length > 0) {
        @for (level of ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']; track level) {
          @if (exercisesByDifficulty(level).length > 0) {
            <div class="difficulty-section">
              <span class="difficulty-badge" [attr.data-level]="level">{{ difficultyLabel(level) }}</span>
            </div>
            <div class="exercise-list">
              @for (ex of exercisesByDifficulty(level); track ex.id) {
                <a class="exercise-card" [routerLink]="['/exercises', ex.id]">
                  <span class="exercise-name">{{ ex.name }}</span>
                  @if (ex.equipment.length > 0) {
                    <div class="equip-row">
                      @for (e of ex.equipment; track e.id) {
                        <a class="equip-chip" [routerLink]="['/equipment', e.id]">{{ e.name }}</a>
                      }
                    </div>
                  }
                </a>
              }
            </div>
          }
        }
      } @else {
        <p class="empty-text">No exercises target {{ t.name }} yet.</p>
      }
    }
  `,
  styles: `
    h2 { margin: 0 0 0.25rem; }
    h3 { margin: 1.5rem 0 0.75rem; }
    .back-row { margin-bottom: 0.5rem; }
    .category-label { font-size: 0.8125rem; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.05em; }
    .exercise-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .exercise-card {
      display: flex; flex-direction: column; gap: 0.25rem;
      padding: 12px 16px; border-radius: 12px; text-decoration: none; color: inherit;
      background: var(--mat-sys-surface-container, #efedf0);
      &:hover { background: var(--mat-sys-surface-container-high, #e9e7eb); }
    }
    .difficulty-section { margin: 1rem 0 0.5rem; }
    .difficulty-badge {
      font-size: 0.6875rem; font-weight: 600; padding: 2px 8px; border-radius: 4px;
      &[data-level="BEGINNER"] { background: rgba(76,175,80,0.15); color: #4caf50; }
      &[data-level="INTERMEDIATE"] { background: rgba(255,165,0,0.15); color: #ffa500; }
      &[data-level="ADVANCED"] { background: rgba(244,67,54,0.15); color: #f44336; }
    }
    .exercise-name { font-weight: 500; }
    .equip-row { display: flex; flex-wrap: wrap; gap: 4px; }
    .equip-chip {
      font-size: 0.6875rem; padding: 2px 8px; border-radius: 9999px; text-decoration: none;
      background: var(--mat-sys-secondary-container, #dae2f9); color: var(--mat-sys-on-secondary-container, #3e4759);
      &:hover { filter: brightness(0.95); }
    }
    .empty-text { opacity: 0.5; }
  `,
})
export class TargetDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);

  readonly target = signal<TargetDetail | null>(null);
  readonly exercises = signal<ExerciseForTarget[]>([]);

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('targetId'));
    try {
      // Load all exercises and filter by target
      const [targets, exerciseData] = await Promise.all([
        firstValueFrom(this.http.get<{ targets: TargetDetail[] }>('/api/v1/targets')),
        firstValueFrom(this.http.get<{ exercises: { id: number; name: string; difficulty: string; targets: Ref[]; equipment: Ref[] }[] }>('/api/v1/exercises')),
      ]);
      this.target.set(targets.targets.find(t => t.id === id) ?? null);

      const matching = exerciseData.exercises
        .filter(ex => ex.targets.some(t => t.id === id))
        .sort((a, b) => a.name.localeCompare(b.name));
      this.exercises.set(matching);
    } catch { /* ignore */ }
  }

  exercisesByDifficulty(level: string): ExerciseForTarget[] {
    return this.exercises().filter(e => e.difficulty === level);
  }

  difficultyLabel(d: string): string {
    switch (d) { case 'BEGINNER': return 'Beginner'; case 'ADVANCED': return 'Advanced'; default: return 'Intermediate'; }
  }

  categoryLabel(c: string): string {
    switch (c) { case 'MUSCLE': return 'Muscle'; case 'MUSCLE_GROUP': return 'Muscle Group'; case 'OBJECTIVE': return 'Objective'; default: return c; }
  }
}
