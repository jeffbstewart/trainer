import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

interface Ref { id: number; name: string; }
interface ExerciseDetail {
  id: number; name: string; description: string | null; form_notes: string | null;
  equipment: Ref[]; difficulty: string;
  targets: { id: number; name: string; category: string }[];
}

@Component({
  selector: 'app-exercise-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatChipsModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    @if (exercise(); as ex) {
      <div class="back-row">
        <a mat-button routerLink="/exercises"><mat-icon>arrow_back</mat-icon> All Exercises</a>
        <button mat-flat-button color="primary" (click)="openEdit()"><mat-icon>edit</mat-icon> Edit</button>
      </div>

      <h2>{{ ex.name }}</h2>

      <div class="detail-grid">
        @if (ex.equipment.length > 0) {
          <div class="detail-row">
            <span class="label">Equipment</span>
            <div class="chip-row">
              @for (e of ex.equipment; track e.id) {
                <a class="equip-chip" [routerLink]="['/equipment', e.id]">{{ e.name }}</a>
              }
            </div>
          </div>
        }
        <div class="detail-row">
          <span class="label">Difficulty</span>
          <span class="difficulty-badge" [attr.data-level]="ex.difficulty">{{ difficultyLabel(ex.difficulty) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Targets</span>
          <div class="chip-row">
            @for (t of ex.targets; track t.id) {
              <a class="target-chip" [routerLink]="['/targets', t.id]">{{ t.name }}</a>
            }
            @if (ex.targets.length === 0) { <span class="muted">None</span> }
          </div>
        </div>
      </div>

      @if (ex.description) {
        <h3>Description</h3>
        <p class="text-block">{{ ex.description }}</p>
      }

      @if (ex.form_notes) {
        <h3>Form Notes</h3>
        <p class="text-block">{{ ex.form_notes }}</p>
      }

    }

    @if (editOpen()) {
      <div class="modal-overlay" (click)="closeEdit()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Edit Exercise</h3>
          @if (editError()) { <p class="error-text">{{ editError() }}</p> }
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Name</mat-label>
            <input matInput [value]="editName()" (input)="editName.set($any($event.target).value)" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description</mat-label>
            <textarea matInput [value]="editDescription()" (input)="editDescription.set($any($event.target).value)" rows="3"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Form Notes</mat-label>
            <textarea matInput [value]="editFormNotes()" (input)="editFormNotes.set($any($event.target).value)" rows="3"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Targets</mat-label>
            <mat-select [value]="editTargetIds()" (selectionChange)="editTargetIds.set($event.value)" multiple>
              @for (t of availableTargets(); track t.id) {
                <mat-option [value]="t.id">{{ t.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <div class="inline-add">
            <mat-form-field appearance="outline" class="inline-add-field">
              <mat-label>New target</mat-label>
              <input matInput [value]="newTargetName()" (input)="newTargetName.set($any($event.target).value)"
                     (keydown.enter)="addTarget()" />
            </mat-form-field>
            <button mat-icon-button [disabled]="!newTargetName().trim()" (click)="addTarget()"><mat-icon>add</mat-icon></button>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Equipment</mat-label>
            <mat-select [value]="editEquipmentIds()" (selectionChange)="editEquipmentIds.set($event.value)" multiple>
              @for (e of availableEquipment(); track e.id) {
                <mat-option [value]="e.id">{{ e.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <div class="inline-add">
            <mat-form-field appearance="outline" class="inline-add-field">
              <mat-label>New equipment</mat-label>
              <input matInput [value]="newEquipmentName()" (input)="newEquipmentName.set($any($event.target).value)"
                     (keydown.enter)="addEquipment()" />
            </mat-form-field>
            <button mat-icon-button [disabled]="!newEquipmentName().trim()" (click)="addEquipment()"><mat-icon>add</mat-icon></button>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Difficulty</mat-label>
            <mat-select [value]="editDifficulty()" (selectionChange)="editDifficulty.set($event.value)">
              <mat-option value="BEGINNER">Beginner</mat-option>
              <mat-option value="INTERMEDIATE">Intermediate</mat-option>
              <mat-option value="ADVANCED">Advanced</mat-option>
            </mat-select>
          </mat-form-field>
          <div class="modal-actions">
            <button mat-stroked-button (click)="closeEdit()">Cancel</button>
            <button mat-flat-button color="primary" [disabled]="!editName().trim()" (click)="saveEdit()">Save</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    h2 { margin: 0 0 1rem; }
    h3 { margin: 1.5rem 0 0.5rem; font-size: 1rem; }
    .back-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
    .detail-grid { display: flex; flex-direction: column; gap: 0.5rem; }
    .detail-row { display: flex; gap: 1rem; align-items: center; }
    .label { font-weight: 600; min-width: 120px; opacity: 0.6; }
    .chip-row { display: flex; flex-wrap: wrap; gap: 4px; }
    .target-chip {
      font-size: 0.6875rem; padding: 2px 8px; border-radius: 9999px; text-decoration: none;
      background: var(--mat-sys-primary-container, #d7e3ff); color: var(--mat-sys-on-primary-container, #00458f);
      &:hover { filter: brightness(0.95); }
    }
    .equip-chip {
      font-size: 0.6875rem; padding: 2px 8px; border-radius: 9999px; text-decoration: none;
      background: var(--mat-sys-secondary-container, #dae2f9); color: var(--mat-sys-on-secondary-container, #3e4759);
      &:hover { filter: brightness(0.95); }
    }
    .difficulty-badge {
      font-size: 0.6875rem; font-weight: 600; padding: 2px 8px; border-radius: 4px;
      &[data-level="BEGINNER"] { background: rgba(76,175,80,0.15); color: #4caf50; }
      &[data-level="INTERMEDIATE"] { background: rgba(255,165,0,0.15); color: #ffa500; }
      &[data-level="ADVANCED"] { background: rgba(244,67,54,0.15); color: #f44336; }
    }
    .muted { opacity: 0.4; }
    .text-block { white-space: pre-line; line-height: 1.6; opacity: 0.8; }
    .full-width { width: 100%; }
    .modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal-content {
      background: var(--mat-sys-surface-container-high, #e9e7eb); color: var(--mat-sys-on-surface, #1a1b1f);
      border-radius: 12px; padding: 1.5rem; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto;
      h3 { margin: 0 0 1rem; }
    }
    .inline-add { display: flex; align-items: center; gap: 0.25rem; margin-top: -0.75rem; margin-bottom: 0.5rem; }
    .inline-add-field { flex: 1; font-size: 0.8125rem; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
    .error-text { color: #f44336; font-size: 0.8125rem; }
  `,
})
export class ExerciseDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);

  readonly exercise = signal<ExerciseDetail | null>(null);

  // Edit dialog
  readonly editOpen = signal(false);
  readonly editName = signal('');
  readonly editDescription = signal('');
  readonly editFormNotes = signal('');
  readonly editTargetIds = signal<number[]>([]);
  readonly editEquipmentIds = signal<number[]>([]);
  readonly editDifficulty = signal('INTERMEDIATE');
  readonly editError = signal('');
  readonly availableTargets = signal<Ref[]>([]);
  readonly availableEquipment = signal<Ref[]>([]);
  readonly newTargetName = signal('');
  readonly newEquipmentName = signal('');

  private exerciseId = 0;

  async ngOnInit(): Promise<void> {
    this.route.paramMap.subscribe(async params => {
      this.exerciseId = Number(params.get('exerciseId'));
      this.exercise.set(null);
      await this.refresh();
    });
  }

  difficultyLabel(d: string): string {
    switch (d) { case 'BEGINNER': return 'Beginner'; case 'ADVANCED': return 'Advanced'; default: return 'Intermediate'; }
  }

  async refresh(): Promise<void> {
    try {
      this.exercise.set(await firstValueFrom(this.http.get<ExerciseDetail>(`/api/v1/exercises/${this.exerciseId}`)));
    } catch { /* ignore */ }
  }

  async openEdit(): Promise<void> {
    const ex = this.exercise();
    if (!ex) return;

    // Load available targets and equipment for multi-selects
    const [targets, equipment] = await Promise.all([
      firstValueFrom(this.http.get<{ targets: Ref[] }>('/api/v1/targets')),
      firstValueFrom(this.http.get<{ equipment: Ref[] }>('/api/v1/equipment')),
    ]);
    this.availableTargets.set(targets.targets);
    this.availableEquipment.set(equipment.equipment);

    this.editName.set(ex.name);
    this.editDescription.set(ex.description ?? '');
    this.editFormNotes.set(ex.form_notes ?? '');
    this.editTargetIds.set(ex.targets.map(t => t.id));
    this.editEquipmentIds.set(ex.equipment.map(e => e.id));
    this.editDifficulty.set(ex.difficulty);
    this.editError.set('');
    this.newTargetName.set('');
    this.newEquipmentName.set('');
    this.editOpen.set(true);
  }

  closeEdit(): void { this.editOpen.set(false); }

  async addTarget(): Promise<void> {
    const name = this.newTargetName().trim();
    if (!name) return;
    try {
      const r = await firstValueFrom(this.http.post<{ ok: boolean; id: number }>('/api/v1/targets', { name }));
      if (r.id) {
        this.availableTargets.update(list => [...list, { id: r.id, name }]);
        this.editTargetIds.update(ids => [...ids, r.id]);
        this.newTargetName.set('');
      }
    } catch (e: unknown) {
      this.editError.set((e as { error?: { error?: string } })?.error?.error ?? 'Failed to create target');
    }
  }

  async addEquipment(): Promise<void> {
    const name = this.newEquipmentName().trim();
    if (!name) return;
    try {
      const r = await firstValueFrom(this.http.post<{ ok: boolean; id: number }>('/api/v1/equipment', { name }));
      if (r.id) {
        this.availableEquipment.update(list => [...list, { id: r.id, name }]);
        this.editEquipmentIds.update(ids => [...ids, r.id]);
        this.newEquipmentName.set('');
      }
    } catch (e: unknown) {
      this.editError.set((e as { error?: { error?: string } })?.error?.error ?? 'Failed to create equipment');
    }
  }

  async saveEdit(): Promise<void> {
    this.editError.set('');
    try {
      await firstValueFrom(this.http.post(`/api/v1/exercises/${this.exerciseId}`, {
        name: this.editName().trim(),
        description: this.editDescription().trim() || null,
        form_notes: this.editFormNotes().trim() || null,
        target_ids: this.editTargetIds(),
        equipment_ids: this.editEquipmentIds(),
        difficulty: this.editDifficulty(),
      }));
      this.closeEdit();
      await this.refresh();
    } catch (e: unknown) {
      this.editError.set((e as { error?: { error?: string } })?.error?.error ?? 'Save failed');
    }
  }
}
