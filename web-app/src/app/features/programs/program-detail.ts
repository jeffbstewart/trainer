import { Component, inject, signal, viewChild, ElementRef, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { CdkDropList, CdkDrag, CdkDragHandle, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ExercisePickerDialogComponent, ExercisePickerData, ExercisePickerResult } from '../../shared/exercise-picker-dialog';

interface ExerciseRef { id: number; name: string; sort_order: number; }
interface SetData { id: number; round_number: number; weight: number | null; reps: number | null; unit: string; weight_direction: string | null; weight_marker: string | null; reps_marker: string | null; skipped: boolean; }
interface SessionExerciseData { exercise_id: number; sets: SetData[]; set_style: string | null; resistance_note: string | null; substitute_exercise_id: number | null; substitute_exercise_name: string | null; notes: string | null; }
interface SessionData { id: number; session_date: string | null; notes: string | null; exercises: SessionExerciseData[]; }
interface WorkoutData { id: number; name: string; plan_type: string; exercises: ExerciseRef[]; sessions: SessionData[]; }
interface ProgramDetail {
  id: number; name: string; sequence: string | null;
  trainee_id: number; trainee_name: string; trainer_id: number;
  started_at: string | null; ended_at: string | null;
  workouts: WorkoutData[];
}
interface AvailableExercise { id: number; name: string; }

const WeightUnit = { LBS: 'lbs', KG: 'kg', BAND: 'band', BW: 'bw' } as const;
const WeightDirection = { UP: 'up', DOWN: 'down' } as const;

@Component({
  selector: 'app-program-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule, MatInputModule, CdkDropList, CdkDrag, CdkDragHandle],
  template: `
    @if (program(); as p) {
      <div class="back-row">
        <a mat-button routerLink="/programs"><mat-icon>arrow_back</mat-icon> All Programs</a>
      </div>

      <div class="program-header">
        <h2>{{ p.name }}</h2>
        <span class="meta">{{ p.trainee_name }} @if (p.sequence) { &middot; #{{ p.sequence }} }</span>
        <button mat-icon-button (click)="locked.set(!locked())" [title]="locked() ? 'Unlock editing' : 'Lock editing'">
          <mat-icon>{{ locked() ? 'lock' : 'lock_open' }}</mat-icon>
        </button>
      </div>

      <!-- Add Workout button -->
      @if (p.workouts.length < 4) {
        <button mat-stroked-button (click)="openAddWorkout()">
          <mat-icon>add</mat-icon> Add Workout
        </button>
      }

      <!-- Workout grids -->
      <div cdkDropList [cdkDropListDisabled]="locked()" (cdkDropListDropped)="dropWorkout($event)">
      @for (workout of p.workouts; track workout.id) {
        <div class="workout-section" cdkDrag [cdkDragDisabled]="locked()">
          <div class="workout-header">
            @if (!locked()) {
              <mat-icon class="drag-handle" cdkDragHandle>drag_indicator</mat-icon>
            }
            <h3>{{ workout.name }}</h3>
            <span class="plan-type">{{ workout.plan_type }}</span>
            @if (!locked()) {
              <button mat-stroked-button class="small-btn" (click)="openAddExerciseDialog(workout)">
                <mat-icon>add</mat-icon> Exercise
              </button>
            }
            <button mat-stroked-button class="small-btn" (click)="addSession(workout)">
              <mat-icon>event</mat-icon> New Session
            </button>
            @if (!locked()) {
              <button mat-icon-button color="warn" (click)="deleteWorkout(workout)" title="Delete workout">
                <mat-icon>delete</mat-icon>
              </button>
            }
          </div>

          @if (workout.exercises.length > 0) {
            <div class="grid-container">
              <table class="session-grid">
                <thead>
                  <tr>
                    <th class="exercise-col">Exercise</th>
                    @for (session of workout.sessions; track session.id) {
                      <th [attr.colspan]="maxRounds(session)" class="session-header">
                        <span class="session-date-cell">
                          <input type="date" class="date-input" [value]="session.session_date ?? ''"
                                 (change)="updateSessionDate(session, $any($event.target).value)" />
                          @if (!locked()) {
                            <button class="delete-session-btn" (click)="deleteSession(session, workout)" title="Delete session">&times;</button>
                          }
                        </span>
                      </th>
                    }
                  </tr>
                  @if (workout.sessions.length > 0) {
                    <tr>
                      <th></th>
                      @for (session of workout.sessions; track session.id) {
                        @for (r of roundRange(maxRounds(session)); track r; let last = $last) {
                          <th class="round-header" [class.session-end]="last">R{{ r }}</th>
                        }
                      }
                    </tr>
                  }
                </thead>
                <tbody cdkDropList [cdkDropListData]="workout" [cdkDropListDisabled]="locked()" (cdkDropListDropped)="dropExercise($event, workout)">
                  @for (exercise of workout.exercises; track exercise.id; let idx = $index) {
                    @if (workout.sessions.length > 0) {
                      <tr class="sub-row" [class.sub-row-empty]="!hasAnyOverride(workout, exercise.id)">
                        <td class="sub-row-label"></td>
                        @for (session of workout.sessions; track session.id) {
                          <td class="sub-cell" [attr.colspan]="maxRounds(session)" (click)="openExerciseNote(session, exercise, $event)">
                            @if (getSessionExercise(session, exercise.id); as se) {
                              @if (se.substitute_exercise_name || se.resistance_note) {
                                <span class="sub-text">{{ se.substitute_exercise_name ?? '' }}{{ se.substitute_exercise_name && se.resistance_note ? ' · ' : '' }}{{ se.resistance_note ?? '' }}</span>
                              } @else {
                                <span class="sub-text sub-add">+</span>
                              }
                            } @else {
                              <span class="sub-text sub-add">+</span>
                            }
                          </td>
                        }
                      </tr>
                    }
                    <tr cdkDrag [cdkDragDisabled]="locked()" [class.exercise-even]="idx % 2 === 1">
                      <td class="exercise-name">
                        @if (!locked()) {
                          <mat-icon class="drag-handle exercise-drag" cdkDragHandle>drag_indicator</mat-icon>
                        }
                        <a [routerLink]="['/exercises', exercise.id]">{{ exercise.name }}</a>
                      </td>
                      @for (session of workout.sessions; track session.id) {
                        @for (r of roundRange(maxRounds(session)); track r; let last = $last) {
                          <td class="set-cell" [class.session-end]="last" (click)="openSetEdit(session, exercise, r)">
                            @if (getSet(session, exercise.id, r); as s) {
                              @if (s.skipped) {
                                <div class="set-box set-skipped"></div>
                              } @else {
                                <div class="set-box">
                                  <span class="set-weight">{{ formatWeight(s) }}{{ s.weight_marker ?? '' }}{{ s.weight_direction === WeightDirection.UP ? '\u2191' : s.weight_direction === WeightDirection.DOWN ? '\u2193' : '' }}</span>
                                  <span class="set-reps">{{ s.reps ?? '?' }}{{ s.reps_marker ?? '' }}</span>
                                </div>
                              }
                            } @else {
                              <span class="set-empty">—</span>
                            }
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
      </div>

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

          @if (!creatingNewExercise()) {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Exercise</mat-label>
              <mat-select (selectionChange)="selectedExerciseId.set($event.value)">
                @for (ex of availableExercises(); track ex.id) {
                  <mat-option [value]="ex.id">{{ ex.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <div class="modal-actions">
              <button mat-stroked-button (click)="startNewExercise()">New Exercise</button>
              <span class="spacer"></span>
              <button mat-stroked-button (click)="showAddExercise.set(false)">Cancel</button>
              <button mat-flat-button color="primary" [disabled]="!selectedExerciseId()" (click)="submitAddExercise()">Add</button>
            </div>
          } @else {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Exercise Name</mat-label>
              <input matInput #newExerciseInput [value]="newExerciseName()" (input)="newExerciseName.set($any($event.target).value)" />
            </mat-form-field>
            <div class="modal-actions">
              <button mat-stroked-button (click)="creatingNewExercise.set(false)">Back</button>
              <span class="spacer"></span>
              <button mat-stroked-button (click)="showAddExercise.set(false)">Cancel</button>
              <button mat-flat-button color="primary" [disabled]="!newExerciseName().trim()" (click)="createAndAddExercise()">Create &amp; Add</button>
            </div>
          }
        </div>
      </div>
    }

    <!-- Record Set Dialog -->
    @if (showSetEdit()) {
      <div class="modal-overlay" (click)="showSetEdit.set(false)">
        <div class="modal-content set-edit-dialog" (click)="$event.stopPropagation()">
          <h3>{{ setEditExerciseName() }} — R{{ setEditRound() }}</h3>
          <span class="set-edit-date">{{ setEditDate() }}</span>
          <div class="set-edit-fields">
            <mat-form-field appearance="outline" class="set-field">
              <mat-label>Weight</mat-label>
              <input matInput #weightInput type="number" inputmode="decimal" step="0.5"
                     [value]="setEditWeight()" (input)="setEditWeight.set($any($event.target).value)" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="set-field">
              <mat-label>Reps</mat-label>
              <input matInput type="number" inputmode="decimal" step="0.5"
                     [value]="setEditReps()" (input)="setEditReps.set($any($event.target).value)"
                     (keydown.enter)="submitSetEdit()" />
            </mat-form-field>
          </div>
          <div class="modal-actions">
            <button mat-stroked-button [class.skipped-active]="setEditSkipped()" (click)="setEditSkipped.set(!setEditSkipped())">
              <mat-icon>block</mat-icon> {{ setEditSkipped() ? 'Skipped' : 'Skip' }}
            </button>
            <button mat-stroked-button (click)="setEditMore.set(!setEditMore())">
              <mat-icon>{{ setEditMore() ? 'expand_less' : 'tune' }}</mat-icon> More
            </button>
            <span class="spacer"></span>
            <button mat-stroked-button (click)="showSetEdit.set(false)">Cancel</button>
            <button mat-flat-button color="primary" (click)="submitSetEdit()">Save</button>
          </div>
          @if (setEditMore()) {
            <div class="more-section">
              <div class="set-edit-fields">
                <mat-form-field appearance="outline" class="unit-field">
                  <mat-label>Unit</mat-label>
                  <mat-select [value]="setEditUnit()" (selectionChange)="setEditUnit.set($event.value)">
                    <mat-option [value]="WeightUnit.LBS">lbs</mat-option>
                    <mat-option [value]="WeightUnit.KG">kg</mat-option>
                    <mat-option [value]="WeightUnit.BAND">band</mat-option>
                    <mat-option [value]="WeightUnit.BW">BW</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="marker-field">
                  <mat-label>Wt mark</mat-label>
                  <input matInput [value]="setEditWeightMarker()" maxlength="1"
                         (input)="setEditWeightMarker.set($any($event.target).value)" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="marker-field">
                  <mat-label>Rep mark</mat-label>
                  <input matInput [value]="setEditRepsMarker()" maxlength="1"
                         (input)="setEditRepsMarker.set($any($event.target).value)" />
                </mat-form-field>
              </div>
              <div class="direction-row">
                <span class="direction-label">Next time:</span>
                <button mat-icon-button [class.direction-active]="setEditDirection() === WeightDirection.UP" (click)="toggleDirection(WeightDirection.UP)" title="More weight">
                  <mat-icon>arrow_upward</mat-icon>
                </button>
                <button mat-icon-button [class.direction-active]="setEditDirection() === WeightDirection.DOWN" (click)="toggleDirection(WeightDirection.DOWN)" title="Less weight">
                  <mat-icon>arrow_downward</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    }

    <!-- Exercise Note Dialog (substitution / annotation) -->
    @if (showExerciseNote()) {
      <div class="modal-overlay" (click)="showExerciseNote.set(false)">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>{{ exerciseNoteName() }} — {{ exerciseNoteDate() }}</h3>
          <div class="sub-picker-row">
            <span class="sub-picker-label">Substitution:</span>
            <button mat-stroked-button class="sub-picker-btn" (click)="openSubstitutePicker()">
              {{ exerciseNoteSubName() || 'None — tap to select' }}
            </button>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Resistance note</mat-label>
            <input matInput [value]="exerciseNoteResistance()" (input)="exerciseNoteResistance.set($any($event.target).value)"
                   placeholder="e.g. GREEN" />
          </mat-form-field>
          <div class="modal-actions">
            <button mat-stroked-button (click)="showExerciseNote.set(false)">Cancel</button>
            <button mat-flat-button color="primary" (click)="submitExerciseNote()">Save</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    h2 { margin: 0; }
    h3 { margin: 0; }
    .back-row { margin-bottom: 0.5rem; }
    .program-header { margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .meta { font-size: 0.8125rem; opacity: 0.5; }
    .workout-section { margin-top: 1.5rem; }
    .workout-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
    .plan-type { font-size: 0.6875rem; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.05em; }
    .small-btn { font-size: 0.75rem; }

    .grid-container { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .session-grid {
      border-collapse: separate; border-spacing: 0;
      th, td { padding: 3px 4px; border: 1px solid var(--mat-sys-outline-variant, #c4c6d0); text-align: center; font-size: 0.6875rem; }
      th { background: var(--mat-sys-surface-container, #efedf0); font-weight: 600; }
      th:first-child, td:first-child {
        position: -webkit-sticky; position: sticky; left: 0; z-index: 1;
        background: var(--mat-sys-surface, #fdfbff);
        border-right: 2px solid var(--mat-sys-outline, #74777f);
      }
      th:first-child { z-index: 2; background: var(--mat-sys-surface-container, #efedf0); }
    }
    .exercise-col { text-align: left; width: 120px; min-width: 80px; max-width: 120px; }
    tr.exercise-even td { background: rgba(76, 175, 80, 0.06); }
    tr.exercise-even td:first-child { background: var(--mat-sys-surface, #fdfbff); }
    .sub-row td:first-child { background: var(--mat-sys-surface, #fdfbff); }
    .exercise-name {
      text-align: left; font-weight: 500; font-size: 0.625rem;
      white-space: normal; word-break: break-word; line-height: 1.2;
      height: 40px; vertical-align: middle;
      a { color: var(--mat-sys-primary, #005cbb); text-decoration: none; flex: 1; }
      a:hover { text-decoration: underline; }
    }
    .session-header { font-size: 0.6875rem; padding: 4px !important; }
    .session-date-cell { display: flex; align-items: center; justify-content: center; gap: 2px; }
    .date-input {
      font-size: 0.6875rem; border: none; background: transparent; color: inherit;
      padding: 2px; width: 110px; text-align: center; cursor: pointer;
      &::-webkit-calendar-picker-indicator { opacity: 0.4; cursor: pointer; }
    }
    .delete-session-btn {
      border: none; background: none; color: #f44336; cursor: pointer;
      font-size: 1rem; line-height: 1; padding: 0 2px; opacity: 0.5;
      &:hover { opacity: 1; }
    }
    .round-header { font-size: 0.625rem; opacity: 0.5; }
    .session-end { border-right: 2px solid var(--mat-sys-outline, #74777f) !important; }
    .set-cell {
      padding: 2px !important; cursor: pointer; width: 50px; min-width: 50px; max-width: 50px; vertical-align: middle; position: relative;
      &:hover { background: var(--mat-sys-primary-container, #d7e3ff); }
      &:active { background: var(--mat-sys-primary, #005cbb); color: white; }
    }
    .set-box {
      position: relative; width: 42px; height: 36px; margin: 0 auto;
      background: linear-gradient(to bottom right, transparent calc(50% - 0.5px), var(--mat-sys-outline-variant, #c4c6d0) 50%, transparent calc(50% + 0.5px));
    }
    .set-weight {
      position: absolute; top: 1px; left: 2px;
      font-size: 0.5625rem; font-weight: 600; line-height: 1;
    }
    .set-reps {
      position: absolute; bottom: 1px; right: 2px;
      font-size: 0.5625rem; font-weight: 600; line-height: 1;
    }
    .set-skipped {
      background:
        linear-gradient(to bottom right, transparent calc(50% - 0.5px), var(--mat-sys-outline-variant, #c4c6d0) 50%, transparent calc(50% + 0.5px)),
        linear-gradient(to bottom left, transparent calc(50% - 0.5px), var(--mat-sys-outline-variant, #c4c6d0) 50%, transparent calc(50% + 0.5px)) !important;
    }
    .sub-row td { padding: 0 !important; border-bottom: none !important; }
    .sub-row-label { height: 0; }
    .sub-row-empty .sub-cell { height: 14px; }
    .sub-row-empty .sub-add { visibility: hidden; }
    .sub-row-empty:hover .sub-add { visibility: visible; }
    .sub-cell {
      cursor: pointer; height: 16px; min-height: 16px;
      font-size: 0.5rem; font-weight: 600; color: var(--mat-sys-tertiary, #6b5778);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      text-align: center; line-height: 16px;
      border-right: 2px solid var(--mat-sys-outline, #74777f) !important;
      &:hover { background: var(--mat-sys-tertiary-container, #f3daff) !important; }
    }
    .sub-text { font-size: 0.5rem; }
    .sub-add { opacity: 0.3; font-weight: 400; }
    .more-section { margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--mat-sys-outline-variant, #c4c6d0); }
    .set-empty { font-size: 0.625rem; opacity: 0.3; }
    .set-edit-dialog { max-width: 380px; }
    .set-edit-date { font-size: 0.8125rem; opacity: 0.5; display: block; margin-bottom: 0.75rem; }
    .set-edit-fields { display: flex; gap: 0.5rem; }
    .set-field { flex: 1; }
    .unit-field { flex: 1; }
    .direction-row { display: flex; align-items: center; gap: 0.25rem; margin-top: -0.5rem; }
    .direction-label { font-size: 0.8125rem; opacity: 0.5; }
    .direction-spacer { flex: 1; }
    .marker-field { flex: 1; }
    .direction-active { color: var(--mat-sys-primary, #005cbb); }
    .skipped-active { color: #f44336; }

    .drag-handle { cursor: grab; opacity: 0.4; font-size: 20px; touch-action: none; }
    .drag-handle:active { cursor: grabbing; }
    .exercise-name { display: flex; align-items: center; gap: 4px; }
    .exercise-drag { font-size: 16px; flex-shrink: 0; }
    .cdk-drag-preview { background: var(--mat-sys-surface-container-high, #e9e7eb); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); padding: 8px; }
    .cdk-drag-placeholder { opacity: 0.3; }
    .cdk-drag-animating { transition: transform 200ms ease; }
    .cdk-drop-list-dragging .cdk-drag { transition: transform 200ms ease; }
    .empty-text { opacity: 0.5; font-size: 0.875rem; }
    .full-width { width: 100%; }
    .modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: var(--mat-sys-surface-container-high, #e9e7eb); color: var(--mat-sys-on-surface, #1a1b1f); border-radius: 12px; padding: 1.5rem; width: 90%; max-width: 400px;
      h3 { margin: 0 0 1rem; }
    }
    .modal-actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
    .sub-picker-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    .sub-picker-label { font-size: 0.8125rem; opacity: 0.6; white-space: nowrap; }
    .sub-picker-btn { text-align: left; min-width: 200px; }
    .spacer { flex: 1; }
  `,
})
export class ProgramDetailComponent implements OnInit {
  readonly WeightUnit = WeightUnit;
  readonly WeightDirection = WeightDirection;
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);

  readonly program = signal<ProgramDetail | null>(null);
  readonly locked = signal(true);
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
  readonly setEditUnit = signal('lbs');
  readonly setEditDirection = signal<string | null>(null);
  readonly setEditWeightMarker = signal('');
  readonly setEditRepsMarker = signal('');
  readonly setEditSkipped = signal(false);
  readonly setEditMore = signal(false);
  private readonly weightInput = viewChild<ElementRef>('weightInput');

  // Exercise note dialog (substitution / annotation)
  readonly showExerciseNote = signal(false);
  readonly exerciseNoteSessionId = signal(0);
  readonly exerciseNoteExerciseId = signal(0);
  readonly exerciseNoteName = signal('');
  readonly exerciseNoteDate = signal('');
  readonly exerciseNoteSubId = signal<number | null>(null);
  readonly exerciseNoteSubName = signal('');
  readonly exerciseNoteResistance = signal('');

  // Add exercise dialog
  readonly showAddExercise = signal(false);
  readonly addExerciseWorkoutId = signal(0);
  readonly addExerciseWorkoutName = signal('');
  readonly availableExercises = signal<AvailableExercise[]>([]);
  readonly selectedExerciseId = signal<number | null>(null);
  readonly creatingNewExercise = signal(false);
  readonly newExerciseName = signal('');
  private readonly newExerciseInput = viewChild<ElementRef>('newExerciseInput');

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

  getSet(session: SessionData, exerciseId: number, round: number): SetData | null {
    const ex = session.exercises.find(e => e.exercise_id === exerciseId);
    if (!ex) return null;
    return ex.sets.find(s => s.round_number === round) ?? null;
  }

  formatWeight(s: SetData): string {
    if (s.weight == null) return 'E';
    const suffix = s.unit === WeightUnit.KG ? 'kg' : '';
    return `${s.weight}${suffix}`;
  }

  getSessionExercise(session: SessionData, exerciseId: number): SessionExerciseData | null {
    return session.exercises.find(e => e.exercise_id === exerciseId) ?? null;
  }

  hasAnyOverride(workout: WorkoutData, exerciseId: number): boolean {
    return workout.sessions.some(s => {
      const se = s.exercises.find(e => e.exercise_id === exerciseId);
      return se && (se.substitute_exercise_name || se.resistance_note);
    });
  }

  openExerciseNote(session: SessionData, exercise: ExerciseRef, event: Event): void {
    event.stopPropagation();
    const se = this.getSessionExercise(session, exercise.id);
    this.exerciseNoteSessionId.set(session.id);
    this.exerciseNoteExerciseId.set(exercise.id);
    this.exerciseNoteName.set(exercise.name);
    this.exerciseNoteDate.set(session.session_date ?? 'New');
    this.exerciseNoteSubId.set(se?.substitute_exercise_id ?? null);
    this.exerciseNoteSubName.set(se?.substitute_exercise_name ?? '');
    this.exerciseNoteResistance.set(se?.resistance_note ?? '');
    this.showExerciseNote.set(true);
  }

  openSubstitutePicker(): void {
    // Ensure available exercises are loaded
    if (this.availableExercises().length === 0) {
      this.loadAvailableExercises().then(() => this.showPicker());
    } else {
      this.showPicker();
    }
  }

  private showPicker(): void {
    const ref = this.dialog.open(ExercisePickerDialogComponent, {
      width: '400px',
      data: {
        exercises: this.availableExercises(),
        selectedId: this.exerciseNoteSubId(),
        title: 'Select Substitute Exercise',
      } satisfies ExercisePickerData,
    });
    ref.afterClosed().subscribe((result: ExercisePickerResult | null | undefined) => {
      if (result === undefined) return; // dialog cancelled via backdrop/escape
      if (result === null) {
        // "Clear Substitution" clicked
        this.exerciseNoteSubId.set(null);
        this.exerciseNoteSubName.set('');
      } else {
        this.exerciseNoteSubId.set(result.exerciseId);
        this.exerciseNoteSubName.set(result.exerciseName);
      }
    });
  }

  async submitExerciseNote(): Promise<void> {
    await firstValueFrom(this.http.post(
      `/api/v1/sessions/${this.exerciseNoteSessionId()}/exercises/${this.exerciseNoteExerciseId()}`,
      {
        substitute_exercise_id: this.exerciseNoteSubId(),
        resistance_note: this.exerciseNoteResistance().trim() || null,
      }
    ));
    this.showExerciseNote.set(false);
    await this.refresh();
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

  private async loadAvailableExercises(): Promise<void> {
    try {
      const p = this.program();
      const params: Record<string, string> = {};
      if (p?.trainer_id) params['trainer_id'] = p.trainer_id.toString();
      const d = await firstValueFrom(this.http.get<{ exercises: AvailableExercise[] }>(
        '/api/v1/exercises', { params }));
      this.availableExercises.set(d.exercises);
    } catch { /* ignore */ }
  }

  async openAddExercise(workout: WorkoutData): Promise<void> {
    this.addExerciseWorkoutId.set(workout.id);
    this.addExerciseWorkoutName.set(workout.name);
    this.selectedExerciseId.set(null);
    await this.loadAvailableExercises();
    this.showAddExercise.set(true);
  }

  async openAddExerciseDialog(workout: WorkoutData): Promise<void> {
    this.creatingNewExercise.set(false);
    this.newExerciseName.set('');
    await this.openAddExercise(workout);
  }

  startNewExercise(): void {
    this.creatingNewExercise.set(true);
    setTimeout(() => this.newExerciseInput()?.nativeElement.focus());
  }

  async createAndAddExercise(): Promise<void> {
    const name = this.newExerciseName().trim();
    if (!name) return;
    try {
      const r = await firstValueFrom(this.http.post<{ ok: boolean; id: number }>('/api/v1/exercises', { name }));
      if (r.id) {
        await firstValueFrom(this.http.post(
          `/api/v1/programs/${this.programId}/workouts/${this.addExerciseWorkoutId()}/exercises`,
          { exercise_id: r.id }
        ));
      }
      this.showAddExercise.set(false);
      await this.refresh();
    } catch { /* ignore */ }
  }

  async deleteWorkout(workout: WorkoutData): Promise<void> {
    if (!confirm(`Delete workout "${workout.name}"? This will remove all sessions and recorded data for this workout.`)) return;
    await firstValueFrom(this.http.delete(`/api/v1/programs/${this.programId}/workouts/${workout.id}`));
    await this.refresh();
  }

  async dropWorkout(event: CdkDragDrop<WorkoutData[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const p = this.program();
    if (!p) return;
    const workouts = [...p.workouts];
    moveItemInArray(workouts, event.previousIndex, event.currentIndex);
    this.program.set({ ...p, workouts });
    await firstValueFrom(this.http.post(
      `/api/v1/programs/${this.programId}/workouts/reorder`,
      { workout_ids: workouts.map(w => w.id) }
    ));
  }

  async dropExercise(event: CdkDragDrop<WorkoutData>, workout: WorkoutData): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const exercises = [...workout.exercises];
    moveItemInArray(exercises, event.previousIndex, event.currentIndex);
    workout.exercises = exercises;
    this.program.update(p => p ? { ...p } : p);
    await firstValueFrom(this.http.post(
      `/api/v1/programs/${this.programId}/workouts/${workout.id}/exercises/reorder`,
      { exercise_ids: exercises.map(e => e.id) }
    ));
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

  async updateSessionDate(session: SessionData, date: string): Promise<void> {
    if (!date) return;
    await firstValueFrom(this.http.post(`/api/v1/sessions/${session.id}`, { session_date: date }));
    session.session_date = date;
  }

  async deleteSession(session: SessionData, workout: WorkoutData): Promise<void> {
    if (!confirm(`Delete session ${session.session_date ?? 'New'}? All recorded sets will be lost.`)) return;
    await firstValueFrom(this.http.delete(`/api/v1/sessions/${session.id}`));
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
    this.setEditUnit.set(set?.unit ?? 'lbs');
    this.setEditDirection.set(set?.weight_direction ?? null);
    this.setEditWeightMarker.set(set?.weight_marker ?? '');
    this.setEditRepsMarker.set(set?.reps_marker ?? '');
    this.setEditSkipped.set(set?.skipped ?? false);
    this.setEditMore.set(false);

    this.showSetEdit.set(true);
    setTimeout(() => this.weightInput()?.nativeElement.focus());
  }

  toggleDirection(dir: typeof WeightDirection[keyof typeof WeightDirection]): void {
    this.setEditDirection.set(this.setEditDirection() === dir ? null : dir);
  }

  async submitSetEdit(): Promise<void> {
    const weight = parseFloat(this.setEditWeight());
    const reps = parseFloat(this.setEditReps());

    await firstValueFrom(this.http.post(
      `/api/v1/sessions/${this.setEditSessionId()}/exercises/${this.setEditExerciseId()}/sets`,
      {
        round_number: this.setEditRound(),
        weight: isNaN(weight) ? null : weight,
        reps: isNaN(reps) ? null : reps,
        unit: this.setEditUnit(),
        weight_direction: this.setEditDirection(),
        weight_marker: this.setEditWeightMarker().trim() || null,
        reps_marker: this.setEditRepsMarker().trim() || null,
        skipped: this.setEditSkipped(),
      }
    ));
    this.showSetEdit.set(false);
    await this.refresh();
  }
}
