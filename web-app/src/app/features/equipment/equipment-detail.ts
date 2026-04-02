import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

interface Ref { id: number; name: string; }
interface ExerciseForEquipment {
  id: number; name: string; difficulty: string; targets: Ref[];
}

@Component({
  selector: 'app-equipment-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    @if (equipName()) {
      <div class="back-row">
        <a mat-button routerLink="/equipment"><mat-icon>arrow_back</mat-icon> All Equipment</a>
      </div>

      <h2>{{ equipName() }}</h2>

      <h3>Exercises using this equipment ({{ exercises().length }})</h3>
      @if (exercises().length > 0) {
        <div class="exercise-list">
          @for (ex of exercises(); track ex.id) {
            <a class="exercise-card" [routerLink]="['/exercises', ex.id]">
              <div class="exercise-header">
                <span class="exercise-name">{{ ex.name }}</span>
                <span class="difficulty-badge" [attr.data-level]="ex.difficulty">{{ difficultyLabel(ex.difficulty) }}</span>
              </div>
              @if (ex.targets.length > 0) {
                <div class="chip-row">
                  @for (t of ex.targets; track t.id) {
                    <span class="target-chip">{{ t.name }}</span>
                  }
                </div>
              }
            </a>
          }
        </div>
      } @else {
        <p class="empty-text">No exercises use this equipment yet.</p>
      }
    }
  `,
  styles: `
    h2 { margin: 0 0 0.25rem; }
    h3 { margin: 1.5rem 0 0.75rem; }
    .back-row { margin-bottom: 0.5rem; }
    .exercise-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .exercise-card {
      display: flex; flex-direction: column; gap: 0.25rem;
      padding: 12px 16px; border-radius: 12px; text-decoration: none; color: inherit;
      background: var(--mat-sys-surface-container, #efedf0);
      &:hover { background: var(--mat-sys-surface-container-high, #e9e7eb); }
    }
    .exercise-header { display: flex; align-items: center; gap: 0.5rem; }
    .exercise-name { font-weight: 500; flex: 1; }
    .difficulty-badge {
      font-size: 0.6875rem; font-weight: 600; padding: 2px 8px; border-radius: 4px;
      &[data-level="BEGINNER"] { background: rgba(76,175,80,0.15); color: #4caf50; }
      &[data-level="INTERMEDIATE"] { background: rgba(255,165,0,0.15); color: #ffa500; }
      &[data-level="ADVANCED"] { background: rgba(244,67,54,0.15); color: #f44336; }
    }
    .chip-row { display: flex; flex-wrap: wrap; gap: 4px; }
    .target-chip {
      font-size: 0.6875rem; padding: 2px 8px; border-radius: 9999px;
      background: var(--mat-sys-primary-container, #d7e3ff); color: var(--mat-sys-on-primary-container, #00458f);
    }
    .empty-text { opacity: 0.5; }
  `,
})
export class EquipmentDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);

  readonly equipName = signal('');
  readonly exercises = signal<ExerciseForEquipment[]>([]);

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('equipmentId'));
    try {
      const [equipData, exerciseData] = await Promise.all([
        firstValueFrom(this.http.get<{ equipment: { id: number; name: string }[] }>('/api/v1/equipment')),
        firstValueFrom(this.http.get<{ exercises: { id: number; name: string; difficulty: string; targets: Ref[]; equipment: Ref[] }[] }>('/api/v1/exercises')),
      ]);
      const equip = equipData.equipment.find(e => e.id === id);
      if (equip) this.equipName.set(equip.name);

      const matching = exerciseData.exercises
        .filter(ex => ex.equipment.some(e => e.id === id))
        .sort((a, b) => a.name.localeCompare(b.name));
      this.exercises.set(matching);
    } catch { /* ignore */ }
  }

  difficultyLabel(d: string): string {
    switch (d) { case 'BEGINNER': return 'Beginner'; case 'ADVANCED': return 'Advanced'; default: return 'Intermediate'; }
  }
}
