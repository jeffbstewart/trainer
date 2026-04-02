import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

interface ExerciseRef { id: number; name: string; sort_order: number; }
interface SetData { id: number; round_number: number; weight: number | null; reps: number | null; }
interface SessionExerciseData { exercise_id: number; sets: SetData[]; set_style: string | null; resistance_note: string | null; notes: string | null; }
interface SessionData { id: number; session_date: string | null; notes: string | null; exercises: SessionExerciseData[]; }
interface WorkoutData { id: number; name: string; plan_type: string; exercises: ExerciseRef[]; sessions: SessionData[]; }
interface ProgramDetail {
  id: number; name: string; sequence: string | null;
  trainee_id: number; trainee_name: string;
  started_at: string | null; ended_at: string | null;
  workouts: WorkoutData[];
}
interface AvailableExercise { id: number; name: string; }

@Component({
  selector: 'app-program-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule, MatInputModule],
  template: `
    @if (program(); as p) {
      <div class="back-row">
        <a mat-button routerLink="/programs"><mat-icon>arrow_back</mat-icon> All Programs</a>
      </div>

      <div class="program-header">
        <h2>{{ p.name }}</h2>
        <span class="meta">{{ p.trainee_name }} @if (p.sequence) { &middot; #{{ p.sequence }} }</span>
      </div>

      <!-- Add Workout button -->
      @if (p.workouts.length < 4) {
        <button mat-stroked-button (click)="openAddWorkout()">
          <mat-icon>add</mat-icon> Add Workout
        </button>
      }

      <!-- Workout grids -->
      @for (workout of p.workouts; track workout.id) {
        <div class="workout-section">
          <div class="workout-header">
            <h3>{{ workout.name }}</h3>
            <span class="plan-type">{{ workout.plan_type }}</span>
            <button mat-stroked-button class="small-btn" (click)="openAddExercise(workout)">
              <mat-icon>add</mat-icon> Exercise
            </button>
            <button mat-stroked-button class="small-btn" (click)="addSession(workout)">
              <mat-icon>event</mat-icon> New Session
            </button>
          </div>

          @if (workout.exercises.length > 0) {
            <div class="grid-container">
              <table class="session-grid">
                <thead>
                  <tr>
                    <th class="exercise-col">Exercise</th>
                    @for (session of workout.sessions; track session.id) {
                      <th [attr.colspan]="maxRounds(session)" class="session-header">
                        {{ session.session_date ?? 'New' }}
                      </th>
                    }
                  </tr>
                  @if (workout.sessions.length > 0) {
                    <tr>
                      <th></th>
                      @for (session of workout.sessions; track session.id) {
                        @for (r of roundRange(maxRounds(session)); track r) {
                          <th class="round-header">R{{ r }}</th>
                        }
                      }
                    </tr>
                  }
                </thead>
                <tbody>
                  @for (exercise of workout.exercises; track exercise.id) {
                    <tr>
                      <td class="exercise-name">
                        <a [routerLink]="['/exercises', exercise.id]">{{ exercise.name }}</a>
                      </td>
                      @for (session of workout.sessions; track session.id) {
                        @for (r of roundRange(maxRounds(session)); track r) {
                          <td class="set-cell" (click)="openSetEdit(session, exercise, r)">
                            {{ formatSet(session, exercise.id, r) || '—' }}
                          </td>
                        }
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="empty-text">No exercises yet. Add exercises to this workout.</p>
          }
        </div>
      }

      @if (p.workouts.length === 0) {
        <p class="empty-text">No workouts yet. Add an upper body and lower body workout to get started.</p>
      }
    }

    <!-- Add Workout Dialog -->
    @if (showAddWorkout()) {
      <div class="modal-overlay" (click)="showAddWorkout.set(false)">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Add Workout</h3>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Name</mat-label>
            <input matInput [value]="newWorkoutName()" (input)="newWorkoutName.set($any($event.target).value)"
                   placeholder="e.g. Upper Body A" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Type</mat-label>
            <mat-select [value]="newWorkoutType()" (selectionChange)="newWorkoutType.set($event.value)">
              <mat-option value="UPPER">Upper Body</mat-option>
              <mat-option value="LOWER">Lower Body</mat-option>
              <mat-option value="FULL">Full Body</mat-option>
              <mat-option value="CUSTOM">Custom</mat-option>
            </mat-select>
          </mat-form-field>
          <div class="modal-actions">
            <button mat-stroked-button (click)="showAddWorkout.set(false)">Cancel</button>
            <button mat-flat-button color="primary" [disabled]="!newWorkoutName().trim()" (click)="submitAddWorkout()">Add</button>
          </div>
        </div>
      </div>
    }

    <!-- Add Exercise Dialog -->
    @if (showAddExercise()) {
      <div class="modal-overlay" (click)="showAddExercise.set(false)">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Add Exercise to {{ addExerciseWorkoutName() }}</h3>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Exercise</mat-label>
            <mat-select (selectionChange)="selectedExerciseId.set($event.value)">
              @for (ex of availableExercises(); track ex.id) {
                <mat-option [value]="ex.id">{{ ex.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <div class="modal-actions">
            <button mat-stroked-button (click)="showAddExercise.set(false)">Cancel</button>
            <button mat-flat-button color="primary" [disabled]="!selectedExerciseId()" (click)="submitAddExercise()">Add</button>
          </div>
        </div>
      </div>
    }

    <!-- Record Set Dialog -->
    @if (showSetEdit()) {
      <div class="modal-overlay" (click)="showSetEdit.set(false)">
        <div class="modal-content set-edit-dialog" (click)="$event.stopPropagation()">
          <h3>{{ setEditExerciseName() }} — Round {{ setEditRound() }}</h3>
          <span class="set-edit-date">{{ setEditDate() }}</span>
          <div class="set-edit-fields">
            <mat-form-field appearance="outline" class="set-field">
              <mat-label>Weight</mat-label>
              <input matInput type="number" inputmode="decimal" step="0.5"
                     [value]="setEditWeight()" (input)="setEditWeight.set($any($event.target).value)" />
              <span matTextSuffix>lbs</span>
            </mat-form-field>
            <mat-form-field appearance="outline" class="set-field">
              <mat-label>Reps</mat-label>
              <input matInput type="number" inputmode="numeric"
                     [value]="setEditReps()" (input)="setEditReps.set($any($event.target).value)"
                     (keydown.enter)="submitSetEdit()" />
            </mat-form-field>
          </div>
          <div class="modal-actions">
            <button mat-stroked-button (click)="showSetEdit.set(false)">Cancel</button>
            <button mat-flat-button color="primary" (click)="submitSetEdit()">Save</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    h2 { margin: 0; }
    h3 { margin: 0; }
    .back-row { margin-bottom: 0.5rem; }
    .program-header { margin-bottom: 1rem; }
    .meta { font-size: 0.8125rem; opacity: 0.5; }
    .workout-section { margin-top: 1.5rem; }
    .workout-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
    .plan-type { font-size: 0.6875rem; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.05em; }
    .small-btn { font-size: 0.75rem; }

    .grid-container { overflow-x: auto; }
    .session-grid {
      border-collapse: collapse; width: 100%; min-width: 400px;
      th, td { padding: 6px 8px; border: 1px solid var(--mat-sys-outline-variant, #c4c6d0); text-align: center; font-size: 0.8125rem; }
      th { background: var(--mat-sys-surface-container, #efedf0); font-weight: 600; }
    }
    .exercise-col { text-align: left; min-width: 140px; }
    .exercise-name { text-align: left; font-weight: 500;
      a { color: var(--mat-sys-primary, #005cbb); text-decoration: none; }
      a:hover { text-decoration: underline; }
    }
    .session-header { font-size: 0.6875rem; }
    .round-header { font-size: 0.625rem; opacity: 0.5; }
    .set-cell {
      font-size: 0.75rem; white-space: nowrap; min-width: 60px; cursor: pointer;
      &:hover { background: var(--mat-sys-primary-container, #d7e3ff); }
      &:active { background: var(--mat-sys-primary, #005cbb); color: white; }
    }
    .set-edit-dialog { max-width: 320px; }
    .set-edit-date { font-size: 0.8125rem; opacity: 0.5; display: block; margin-bottom: 0.75rem; }
    .set-edit-fields { display: flex; gap: 0.75rem; }
    .set-field { flex: 1; }

    .empty-text { opacity: 0.5; font-size: 0.875rem; }
    .full-width { width: 100%; }
    .modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: var(--mat-sys-surface-container-high, #e9e7eb); color: var(--mat-sys-on-surface, #1a1b1f); border-radius: 12px; padding: 1.5rem; width: 90%; max-width: 400px;
      h3 { margin: 0 0 1rem; }
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
  `,
})
export class ProgramDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);

  readonly program = signal<ProgramDetail | null>(null);
  private programId = 0;

  // Add workout dialog
  readonly showAddWorkout = signal(false);
  readonly newWorkoutName = signal('');
  readonly newWorkoutType = signal('UPPER');

  // Set edit dialog
  readonly showSetEdit = signal(false);
  readonly setEditSessionId = signal(0);
  readonly setEditExerciseId = signal(0);
  readonly setEditExerciseName = signal('');
  readonly setEditRound = signal(0);
  readonly setEditDate = signal('');
  readonly setEditWeight = signal('');
  readonly setEditReps = signal('');

  // Add exercise dialog
  readonly showAddExercise = signal(false);
  readonly addExerciseWorkoutId = signal(0);
  readonly addExerciseWorkoutName = signal('');
  readonly availableExercises = signal<AvailableExercise[]>([]);
  readonly selectedExerciseId = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    this.route.paramMap.subscribe(async params => {
      this.programId = Number(params.get('programId'));
      this.program.set(null);
      await this.refresh();
    });
  }

  async refresh(): Promise<void> {
    try {
      this.program.set(await firstValueFrom(
        this.http.get<ProgramDetail>(`/api/v1/programs/${this.programId}`)
      ));
    } catch { /* ignore */ }
  }

  maxRounds(session: SessionData): number {
    let max = 0;
    for (const ex of session.exercises) {
      for (const s of ex.sets) {
        if (s.round_number > max) max = s.round_number;
      }
    }
    return Math.max(max, 3); // default to 3 rounds
  }

  roundRange(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i + 1);
  }

  formatSet(session: SessionData, exerciseId: number, round: number): string {
    const ex = session.exercises.find(e => e.exercise_id === exerciseId);
    if (!ex) return '';
    const set = ex.sets.find(s => s.round_number === round);
    if (!set) return '';
    const w = set.weight != null ? set.weight : 'BW';
    const r = set.reps ?? '?';
    return `${w}×${r}`;
  }

  openAddWorkout(): void {
    this.newWorkoutName.set('');
    this.newWorkoutType.set('UPPER');
    this.showAddWorkout.set(true);
  }

  async submitAddWorkout(): Promise<void> {
    await firstValueFrom(this.http.post(`/api/v1/programs/${this.programId}/workouts`, {
      name: this.newWorkoutName().trim(),
      plan_type: this.newWorkoutType(),
    }));
    this.showAddWorkout.set(false);
    await this.refresh();
  }

  async openAddExercise(workout: WorkoutData): Promise<void> {
    this.addExerciseWorkoutId.set(workout.id);
    this.addExerciseWorkoutName.set(workout.name);
    this.selectedExerciseId.set(null);
    try {
      const d = await firstValueFrom(this.http.get<{ exercises: AvailableExercise[] }>('/api/v1/exercises'));
      this.availableExercises.set(d.exercises);
    } catch { /* ignore */ }
    this.showAddExercise.set(true);
  }

  async submitAddExercise(): Promise<void> {
    const eid = this.selectedExerciseId();
    if (!eid) return;
    await firstValueFrom(this.http.post(
      `/api/v1/programs/${this.programId}/workouts/${this.addExerciseWorkoutId()}/exercises`,
      { exercise_id: eid }
    ));
    this.showAddExercise.set(false);
    await this.refresh();
  }

  async addSession(workout: WorkoutData): Promise<void> {
    await firstValueFrom(this.http.post(
      `/api/v1/programs/${this.programId}/workouts/${workout.id}/sessions`, {}
    ));
    await this.refresh();
  }

  openSetEdit(session: SessionData, exercise: ExerciseRef, round: number): void {
    this.setEditSessionId.set(session.id);
    this.setEditExerciseId.set(exercise.id);
    this.setEditExerciseName.set(exercise.name);
    this.setEditRound.set(round);
    this.setEditDate.set(session.session_date ?? 'New session');

    // Pre-fill with existing data if any
    const ex = session.exercises.find(e => e.exercise_id === exercise.id);
    const set = ex?.sets.find(s => s.round_number === round);
    this.setEditWeight.set(set?.weight?.toString() ?? '');
    this.setEditReps.set(set?.reps?.toString() ?? '');

    this.showSetEdit.set(true);
  }

  async submitSetEdit(): Promise<void> {
    const weight = parseFloat(this.setEditWeight());
    const reps = parseInt(this.setEditReps(), 10);

    await firstValueFrom(this.http.post(
      `/api/v1/sessions/${this.setEditSessionId()}/exercises/${this.setEditExerciseId()}/sets`,
      {
        round_number: this.setEditRound(),
        weight: isNaN(weight) ? null : weight,
        reps: isNaN(reps) ? null : reps,
      }
    ));
    this.showSetEdit.set(false);
    await this.refresh();
  }
}
