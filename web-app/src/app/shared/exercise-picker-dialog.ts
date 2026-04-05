import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ExercisePickerData {
  exercises: { id: number; name: string }[];
  /** Pre-selected exercise ID, or null. */
  selectedId: number | null;
  /** Title shown at the top of the dialog. */
  title?: string;
}

export interface ExercisePickerResult {
  exerciseId: number;
  exerciseName: string;
}

@Component({
  selector: 'app-exercise-picker-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <h3 mat-dialog-title>{{ data.title ?? 'Select Exercise' }}</h3>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Search</mat-label>
        <input matInput [value]="search()" (input)="search.set($any($event.target).value)"
               placeholder="Type to filter..." cdkFocusInitial />
        @if (search()) {
          <button matSuffix mat-icon-button (click)="search.set('')"><mat-icon>close</mat-icon></button>
        }
      </mat-form-field>
      <div class="exercise-list">
        @if (search() && !exactMatch()) {
          <button class="exercise-option create-option" (click)="createAndSelect()">
            <mat-icon class="create-icon">add</mat-icon> Create "{{ search() }}"
          </button>
        }
        @for (ex of filtered(); track ex.id) {
          <button class="exercise-option" [class.selected]="selected() === ex.id"
                  (click)="select(ex)">
            {{ ex.name }}
          </button>
        } @empty {
          @if (!search()) {
            <p class="empty">No exercises available</p>
          }
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      @if (selected()) {
        <button mat-stroked-button color="warn" (click)="clear()">Clear Substitution</button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .full-width { width: 100%; }
    .exercise-list { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
    .exercise-option {
      display: block; width: 100%; text-align: left; padding: 8px 12px;
      border: 1px solid transparent; border-radius: 6px; cursor: pointer;
      background: none; color: inherit; font-size: 0.875rem;
    }
    .exercise-option:hover { background: rgba(255,255,255,0.08); }
    .exercise-option.selected { border-color: var(--mat-sys-primary, #6750a4); background: rgba(103,80,164,0.12); }
    .empty { opacity: 0.5; font-size: 0.8125rem; text-align: center; padding: 1rem; }
    .create-option { display: flex; align-items: center; gap: 4px; color: var(--mat-sys-primary, #005cbb); font-weight: 600; }
    .create-icon { font-size: 18px; width: 18px; height: 18px; }
  `,
})
export class ExercisePickerDialogComponent {
  readonly data: ExercisePickerData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ExercisePickerDialogComponent>);
  private readonly http = inject(HttpClient);

  readonly search = signal('');
  readonly selected = signal<number | null>(this.data.selectedId);

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase();
    if (!q) return this.data.exercises;
    return this.data.exercises.filter(e => e.name.toLowerCase().includes(q));
  });

  readonly exactMatch = computed(() => {
    const q = this.search().toLowerCase().trim();
    return q && this.data.exercises.some(e => e.name.toLowerCase() === q);
  });

  select(exercise: { id: number; name: string }): void {
    this.dialogRef.close({ exerciseId: exercise.id, exerciseName: exercise.name } as ExercisePickerResult);
  }

  async createAndSelect(): Promise<void> {
    const name = this.search().trim();
    if (!name) return;
    try {
      const r = await firstValueFrom(this.http.post<{ ok: boolean; id: number }>('/api/v1/exercises', { name }));
      if (r.id) {
        this.dialogRef.close({ exerciseId: r.id, exerciseName: name } as ExercisePickerResult);
      }
    } catch { /* ignore */ }
  }

  clear(): void {
    this.dialogRef.close(null); // null = clear the substitution
  }
}
