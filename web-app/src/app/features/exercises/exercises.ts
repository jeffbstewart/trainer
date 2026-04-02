import { Component, inject, signal, viewChild, OnInit, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';

interface TargetRef { id: number; name: string; }
interface EquipRef { id: number; name: string; }
interface ExerciseRow {
  id: number; name: string; difficulty: string;
  targets: TargetRef[]; equipment: EquipRef[];
}

@Component({
  selector: 'app-exercises',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatChipsModule],
  template: `
    <div class="header-row">
      <h2>Exercises</h2>
      <button mat-flat-button color="primary" (click)="openDialog()">
        <mat-icon>add</mat-icon> New Exercise
      </button>
    </div>

    <mat-form-field appearance="outline" class="search-field">
      <mat-label>Search</mat-label>
      <mat-icon matPrefix>search</mat-icon>
      <input matInput (input)="applyFilter($any($event.target).value)" placeholder="Filter exercises" />
    </mat-form-field>

    <table mat-table [dataSource]="dataSource" matSort class="exercise-table">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Exercise</th>
        <td mat-cell *matCellDef="let ex">
          <a [routerLink]="['/exercises', ex.id]">{{ ex.name }}</a>
        </td>
      </ng-container>
      <ng-container matColumnDef="targets">
        <th mat-header-cell *matHeaderCellDef>Targets</th>
        <td mat-cell *matCellDef="let ex">
          <div class="target-chips">
            @for (t of ex.targets; track t.id) {
              <span class="target-chip">{{ t.name }}</span>
            }
          </div>
        </td>
      </ng-container>
      <ng-container matColumnDef="equipment">
        <th mat-header-cell *matHeaderCellDef>Equipment</th>
        <td mat-cell *matCellDef="let ex">
          <div class="equip-chips">
            @for (e of ex.equipment; track e.id) {
              <span class="equip-chip">{{ e.name }}</span>
            }
          </div>
        </td>
      </ng-container>
      <ng-container matColumnDef="difficulty">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Difficulty</th>
        <td mat-cell *matCellDef="let ex">
          <span class="difficulty-badge" [attr.data-level]="ex.difficulty">{{ difficultyLabel(ex.difficulty) }}</span>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns;"></tr>
    </table>

    <mat-paginator [pageSizeOptions]="[10, 25, 50]" [pageSize]="25" showFirstLastButtons />

    @if (dialogOpen()) {
      <div class="modal-overlay" (click)="closeDialog()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>{{ editId() ? 'Edit Exercise' : 'New Exercise' }}</h3>
          @if (dialogError()) { <p class="error-text">{{ dialogError() }}</p> }
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Name</mat-label>
            <input matInput [value]="dialogName()" (input)="dialogName.set($any($event.target).value)" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Equipment</mat-label>
            <mat-select [value]="dialogEquipmentIds()" (selectionChange)="dialogEquipmentIds.set($event.value)" multiple>
              @for (e of availableEquipment(); track e.id) {
                <mat-option [value]="e.id">{{ e.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Targets</mat-label>
            <mat-select [value]="dialogTargetIds()" (selectionChange)="dialogTargetIds.set($event.value)" multiple>
              @for (t of availableTargets(); track t.id) {
                <mat-option [value]="t.id">{{ t.name }}</mat-option>
              }
            </mat-select>
            <mat-hint>Leave empty to assign "TBD"</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Difficulty</mat-label>
            <mat-select [value]="dialogDifficulty()" (selectionChange)="dialogDifficulty.set($event.value)">
              <mat-option value="BEGINNER">Beginner</mat-option>
              <mat-option value="INTERMEDIATE">Intermediate</mat-option>
              <mat-option value="ADVANCED">Advanced</mat-option>
            </mat-select>
          </mat-form-field>
          <div class="modal-actions">
            <button mat-stroked-button (click)="closeDialog()">Cancel</button>
            <button mat-flat-button color="primary" [disabled]="!dialogName().trim()" (click)="save()">Save</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    h2 { margin: 0; }
    .search-field { width: 100%; max-width: 400px; margin-bottom: 0.5rem; }
    .exercise-table { width: 100%; }
    .exercise-table a { color: var(--mat-sys-primary, #005cbb); text-decoration: none; }
    .exercise-table a:hover { text-decoration: underline; }
    .target-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .target-chip {
      font-size: 0.6875rem; padding: 2px 8px; border-radius: 9999px;
      background: var(--mat-sys-primary-container, #d7e3ff); color: var(--mat-sys-on-primary-container, #00458f);
    }
    .equip-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .equip-chip {
      font-size: 0.6875rem; padding: 2px 8px; border-radius: 9999px;
      background: var(--mat-sys-secondary-container, #dae2f9); color: var(--mat-sys-on-secondary-container, #3e4759);
    }
    .difficulty-badge {
      font-size: 0.6875rem; font-weight: 600; padding: 2px 8px; border-radius: 4px;
      &[data-level="BEGINNER"] { background: rgba(76,175,80,0.15); color: #4caf50; }
      &[data-level="INTERMEDIATE"] { background: rgba(255,165,0,0.15); color: #ffa500; }
      &[data-level="ADVANCED"] { background: rgba(244,67,54,0.15); color: #f44336; }
    }
    .full-width { width: 100%; }
    .modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: var(--mat-sys-surface-container-high, #e9e7eb); color: var(--mat-sys-on-surface, #1a1b1f); border-radius: 12px; padding: 1.5rem; width: 90%; max-width: 500px;
      h3 { margin: 0 0 1rem; }
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
    .error-text { color: #f44336; font-size: 0.8125rem; }
  `,
})
export class ExercisesComponent implements OnInit, AfterViewInit {
  private readonly http = inject(HttpClient);

  readonly sort = viewChild(MatSort);
  readonly paginator = viewChild(MatPaginator);
  readonly dataSource = new MatTableDataSource<ExerciseRow>([]);
  readonly columns = ['name', 'targets', 'equipment', 'difficulty'];

  readonly availableTargets = signal<TargetRef[]>([]);
  readonly availableEquipment = signal<EquipRef[]>([]);
  readonly dialogOpen = signal(false);
  readonly editId = signal<number | null>(null);
  readonly dialogName = signal('');
  readonly dialogTargetIds = signal<number[]>([]);
  readonly dialogEquipmentIds = signal<number[]>([]);
  readonly dialogDifficulty = signal('INTERMEDIATE');
  readonly dialogError = signal('');

  async ngOnInit(): Promise<void> { await this.refresh(); }

  ngAfterViewInit(): void {
    const s = this.sort();
    const p = this.paginator();
    if (s) { this.dataSource.sort = s; s.active = 'name'; s.direction = 'asc'; }
    if (p) this.dataSource.paginator = p;

    // Custom filter: search name, equipment, and target names
    this.dataSource.filterPredicate = (row, filter) => {
      const f = filter.toLowerCase();
      return row.name.toLowerCase().includes(f)
        || row.targets.some(t => t.name.toLowerCase().includes(f))
        || row.equipment.some(e => e.name.toLowerCase().includes(f));
    };
  }

  async refresh(): Promise<void> {
    try {
      const [exercises, targets, equipment] = await Promise.all([
        firstValueFrom(this.http.get<{ exercises: ExerciseRow[] }>('/api/v1/exercises')),
        firstValueFrom(this.http.get<{ targets: TargetRef[] }>('/api/v1/targets')),
        firstValueFrom(this.http.get<{ equipment: EquipRef[] }>('/api/v1/equipment')),
      ]);
      this.dataSource.data = exercises.exercises;
      this.availableTargets.set(targets.targets);
      this.availableEquipment.set(equipment.equipment);
    } catch { /* ignore */ }
  }

  applyFilter(value: string): void { this.dataSource.filter = value.trim().toLowerCase(); }

  difficultyLabel(d: string): string {
    switch (d) { case 'BEGINNER': return 'Beginner'; case 'ADVANCED': return 'Advanced'; default: return 'Intermediate'; }
  }

  openDialog(existing?: ExerciseRow): void {
    this.editId.set(existing?.id ?? null);
    this.dialogName.set(existing?.name ?? '');
    this.dialogTargetIds.set(existing?.targets.map(t => t.id) ?? []);
    this.dialogEquipmentIds.set(existing?.equipment.map(e => e.id) ?? []);
    this.dialogDifficulty.set(existing?.difficulty ?? 'INTERMEDIATE');
    this.dialogError.set('');
    this.dialogOpen.set(true);
  }

  closeDialog(): void { this.dialogOpen.set(false); }

  async save(): Promise<void> {
    this.dialogError.set('');
    const body = {
      name: this.dialogName().trim(),
      target_ids: this.dialogTargetIds(),
      equipment_ids: this.dialogEquipmentIds(),
      difficulty: this.dialogDifficulty(),
    };
    try {
      const id = this.editId();
      if (id) {
        await firstValueFrom(this.http.post(`/api/v1/exercises/${id}`, body));
      } else {
        await firstValueFrom(this.http.post('/api/v1/exercises', body));
      }
      this.closeDialog();
      await this.refresh();
    } catch (e: unknown) {
      this.dialogError.set((e as { error?: { error?: string } })?.error?.error ?? 'Save failed');
    }
  }
}
