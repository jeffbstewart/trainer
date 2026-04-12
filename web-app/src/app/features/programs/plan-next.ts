import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

interface ExerciseRef { id: number; name: string; }
interface HistoryEntry { program_id: number; sequence: string; exercises: ExerciseRef[]; }
interface WorkoutPlan { name: string; plan_type: string; history: HistoryEntry[]; }
interface PlanNextData {
  trainee_id: number; trainee_name: string;
  source_program_id: number; source_program_name: string;
  next_sequence: string | null;
  workouts: WorkoutPlan[];
}

interface SlotEntry { exercise: ExerciseRef | null; ctrl: FormControl<string>; }

@Component({
  selector: 'app-plan-next',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatAutocompleteModule],
  template: `
    @if (data(); as d) {
      <div class="header">
        <a mat-icon-button [routerLink]="['/programs', d.source_program_id]"><mat-icon>arrow_back</mat-icon></a>
        <span class="header-title">Plan Next</span>
        <span class="header-meta">{{ d.trainee_name }} &middot; #{{ d.next_sequence }}</span>
        <span class="spacer"></span>
        <button mat-flat-button color="primary" [disabled]="!canCreate()" (click)="create()">Create Program</button>
      </div>

      @for (workout of d.workouts; track workout.name; let wi = $index) {
        <div class="workout-section">
          <h3>{{ workout.name }} <span class="plan-type">{{ workout.plan_type }}</span></h3>
          @for (slot of slots()[wi]; track $index; let si = $index) {
            <div class="slot-row">
              @if (slot.exercise) {
                <span class="slot-num">{{ si + 1 }}</span>
                <span class="slot-name">{{ slot.exercise.name }}</span>
                <button mat-icon-button class="slot-remove" (click)="removeSlot(wi, si)"><mat-icon>close</mat-icon></button>
              } @else {
                <span class="slot-num">{{ si + 1 }}</span>
                <mat-form-field appearance="outline" class="slot-input">
                  <input matInput [formControl]="slot.ctrl"
                         [matAutocomplete]="auto"
                         placeholder="Exercise..." />
                  <mat-autocomplete #auto="matAutocomplete" (optionSelected)="selectExercise(wi, si, $event.option.value)">
                    @for (ex of filteredExercises(slot.ctrl.value); track ex.id) {
                      <mat-option [value]="ex">{{ ex.name }}</mat-option>
                    }
                    @if ((slot.ctrl.value).trim().length > 0) {
                      <mat-option [value]="{ id: 0, name: slot.ctrl.value.trim() }" class="create-option">
                        + Create "{{ slot.ctrl.value.trim() }}"
                      </mat-option>
                    }
                  </mat-autocomplete>
                </mat-form-field>
              }
            </div>
            <div class="history-scroll">
              @for (h of workout.history; track h.program_id) {
                <span class="history-chip" (click)="copyFromHistory(wi, si, h, si)">
                  @if (h.exercises[si]; as ex) {
                    {{ ex.name }}
                  }
                </span>
              }
            </div>
          }
          <button mat-stroked-button class="add-slot-btn" (click)="addSlot(wi)">
            <mat-icon>add</mat-icon>
          </button>
        </div>
      }
    }
  `,
  styles: `
    .header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .header-title { font-weight: 600; font-size: 1.125rem; }
    .header-meta { font-size: 0.8125rem; opacity: 0.5; }
    .spacer { flex: 1; }
    .workout-section { margin-bottom: 1.5rem; }
    h3 { margin: 0 0 0.5rem; }
    .plan-type { font-size: 0.6875rem; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.05em; }
    .slot-row {
      display: flex; align-items: center; gap: 0.25rem;
      padding: 0.25rem 0; border-bottom: 1px solid var(--mat-sys-outline-variant, #c4c6d0);
    }
    .slot-num { font-size: 0.625rem; opacity: 0.4; min-width: 1rem; text-align: right; }
    .slot-name { flex: 1; font-size: 0.8125rem; font-weight: 500; }
    .slot-remove { width: 24px; height: 24px; flex-shrink: 0; }
    .slot-remove mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .slot-input { flex: 1; font-size: 0.8125rem; }
    .slot-input .mdc-text-field { height: 36px; }
    .history-scroll {
      display: flex; gap: 0.375rem; overflow-x: auto; -webkit-overflow-scrolling: touch;
      padding: 0.25rem 0 0.5rem 1.25rem;
    }
    .history-chip {
      flex-shrink: 0; font-size: 0.6875rem; padding: 2px 8px;
      border-radius: 12px; cursor: pointer; white-space: nowrap;
      background: var(--mat-sys-surface-container, #efedf0);
      color: var(--mat-sys-on-surface, #1a1b1f);
      &:hover { background: var(--mat-sys-primary-container, #d7e3ff); }
      &:empty { display: none; }
    }
    .add-slot-btn { width: 100%; margin-top: 0.25rem; }
    .create-option { font-style: italic; }
  `,
})
export class PlanNextComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  readonly data = signal<PlanNextData | null>(null);
  readonly allExercises = signal<ExerciseRef[]>([]);
  readonly slots = signal<SlotEntry[][]>([]);

  private programId = 0;

  readonly canCreate = computed(() => {
    const s = this.slots();
    return s.length > 0 && s.some(ws => ws.some(slot => slot.exercise !== null));
  });

  async ngOnInit(): Promise<void> {
    this.programId = Number(this.route.snapshot.paramMap.get('programId'));
    const [planData, exerciseData] = await Promise.all([
      firstValueFrom(this.http.get<PlanNextData>(`/api/v1/programs/${this.programId}/plan-next`)),
      firstValueFrom(this.http.get<{ exercises: ExerciseRef[] }>(`/api/v1/exercises`)),
    ]);
    this.data.set(planData);
    this.allExercises.set(exerciseData.exercises.map(e => ({ id: e.id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name)));

    // Initialize blank slots matching the max exercise count from history
    const initialSlots = planData.workouts.map(w => {
      const count = Math.max(1, ...w.history.map(h => h.exercises.length));
      const slots: SlotEntry[] = [];
      for (let i = 0; i < count; i++) {
        slots.push({ exercise: null, ctrl: new FormControl('', { nonNullable: true }) });
      }
      return slots;
    });
    this.slots.set(initialSlots);
  }

  filteredExercises(query: string): ExerciseRef[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.allExercises();
    return this.allExercises().filter(e => e.name.toLowerCase().includes(q));
  }

  selectExercise(wi: number, si: number, ex: ExerciseRef): void {
    if (ex.id === 0) {
      // Create new exercise
      this.createAndSelect(wi, si, ex.name);
      return;
    }
    const s = this.slots().map(ws => [...ws]);
    s[wi][si] = { exercise: ex, ctrl: new FormControl('', { nonNullable: true }) };
    this.slots.set(s);
  }

  private async createAndSelect(wi: number, si: number, name: string): Promise<void> {
    const res = await firstValueFrom(this.http.post<{ ok: boolean; id: number }>('/api/v1/exercises', { name }));
    const ex: ExerciseRef = { id: res.id, name };
    this.allExercises.update(all => [...all, ex].sort((a, b) => a.name.localeCompare(b.name)));
    this.selectExercise(wi, si, ex);
  }

  removeSlot(wi: number, si: number): void {
    const s = this.slots().map(ws => [...ws]);
    s[wi].splice(si, 1);
    this.slots.set(s);
  }

  addSlot(wi: number): void {
    const s = this.slots().map(ws => [...ws]);
    s[wi].push({ exercise: null, ctrl: new FormControl('', { nonNullable: true }) });
    this.slots.set(s);
  }

  copyFromHistory(wi: number, si: number, h: HistoryEntry, histSi: number): void {
    const ex = h.exercises[histSi];
    if (!ex) return;
    const s = this.slots().map(ws => [...ws]);
    // Ensure the slot exists
    while (s[wi].length <= si) {
      s[wi].push({ exercise: null, ctrl: new FormControl('', { nonNullable: true }) });
    }
    s[wi][si] = { exercise: ex, ctrl: new FormControl('', { nonNullable: true }) };
    this.slots.set(s);
  }

  async create(): Promise<void> {
    const d = this.data();
    if (!d) return;
    const workouts = d.workouts.map((w, i) => ({
      name: w.name,
      plan_type: w.plan_type,
      exercise_ids: this.slots()[i].filter(s => s.exercise).map(s => s.exercise!.id),
    }));
    const res = await firstValueFrom(this.http.post<{ ok: boolean; id: number }>(
      `/api/v1/programs/${this.programId}/plan-next`,
      { name: `${d.trainee_name} #${d.next_sequence}`, sequence: d.next_sequence, workouts }
    ));
    this.router.navigate(['/programs', res.id]);
  }
}
