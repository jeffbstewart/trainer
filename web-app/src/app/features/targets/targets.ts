import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';

interface TargetRow { id: number; name: string; category: string; exercise_count: number; }

@Component({
  selector: 'app-targets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatTableModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatChipsModule],
  template: `
    <div class="header-row">
      <h2>Targets</h2>
      <button mat-flat-button color="primary" (click)="openDialog()">
        <mat-icon>add</mat-icon> New Target
      </button>
    </div>

    <div class="target-grid">
      @for (t of targets(); track t.id) {
        <div class="target-card">
          <div class="target-header">
            <a class="target-name" [routerLink]="['/targets', t.id]">{{ t.name }}</a>
            <span class="target-category">{{ categoryLabel(t.category) }}</span>
          </div>
          <span class="target-count">{{ t.exercise_count }} exercise{{ t.exercise_count === 1 ? '' : 's' }}</span>
          <div class="target-actions">
            <button mat-icon-button (click)="openDialog(t)" title="Edit"><mat-icon>edit</mat-icon></button>
            <button mat-icon-button (click)="deleteTarget(t)" title="Delete"><mat-icon>delete</mat-icon></button>
          </div>
        </div>
      }
      @if (targets().length === 0) {
        <p class="empty-text">No targets yet. Create muscle groups and objectives to organize your exercises.</p>
      }
    </div>

    @if (dialogOpen()) {
      <div class="modal-overlay" (click)="closeDialog()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>{{ editId() ? 'Edit Target' : 'New Target' }}</h3>
          @if (dialogError()) { <p class="error-text">{{ dialogError() }}</p> }
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Name</mat-label>
            <input matInput [value]="dialogName()" (input)="dialogName.set($any($event.target).value)" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Category</mat-label>
            <mat-select [value]="dialogCategory()" (selectionChange)="dialogCategory.set($event.value)">
              <mat-option value="MUSCLE">Muscle</mat-option>
              <mat-option value="MUSCLE_GROUP">Muscle Group</mat-option>
              <mat-option value="OBJECTIVE">Objective</mat-option>
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
    .target-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
    .target-card {
      background: var(--mat-sys-surface-container, #efedf0); color: var(--mat-sys-on-surface, #1a1b1f);
      border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.25rem;
    }
    .target-header { display: flex; align-items: center; gap: 0.5rem; }
    .target-name { font-weight: 600; font-size: 1rem; color: var(--mat-sys-primary, #005cbb); text-decoration: none;
      &:hover { text-decoration: underline; }
    }
    .target-category { font-size: 0.6875rem; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.05em; }
    .target-count { font-size: 0.8125rem; opacity: 0.6; }
    .target-actions { display: flex; gap: 0.25rem; margin-top: 0.25rem; }
    .empty-text { opacity: 0.5; grid-column: 1 / -1; }
    .full-width { width: 100%; }
    .modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: var(--mat-sys-surface-container-high, #e9e7eb); color: var(--mat-sys-on-surface, #1a1b1f); border-radius: 12px; padding: 1.5rem; width: 90%; max-width: 400px;
      h3 { margin: 0 0 1rem; }
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
    .error-text { color: #f44336; font-size: 0.8125rem; }
  `,
})
export class TargetsComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly targets = signal<TargetRow[]>([]);
  readonly dialogOpen = signal(false);
  readonly editId = signal<number | null>(null);
  readonly dialogName = signal('');
  readonly dialogCategory = signal('MUSCLE');
  readonly dialogError = signal('');

  async ngOnInit(): Promise<void> { await this.refresh(); }

  async refresh(): Promise<void> {
    try {
      const d = await firstValueFrom(this.http.get<{ targets: TargetRow[] }>('/api/v1/targets'));
      this.targets.set(d.targets);
    } catch { /* ignore */ }
  }

  categoryLabel(c: string): string {
    switch (c) { case 'MUSCLE': return 'Muscle'; case 'MUSCLE_GROUP': return 'Group'; case 'OBJECTIVE': return 'Objective'; default: return c; }
  }

  openDialog(existing?: TargetRow): void {
    this.editId.set(existing?.id ?? null);
    this.dialogName.set(existing?.name ?? '');
    this.dialogCategory.set(existing?.category ?? 'MUSCLE');
    this.dialogError.set('');
    this.dialogOpen.set(true);
  }

  closeDialog(): void { this.dialogOpen.set(false); }

  async save(): Promise<void> {
    this.dialogError.set('');
    const body = { name: this.dialogName().trim(), category: this.dialogCategory() };
    try {
      const id = this.editId();
      if (id) {
        await firstValueFrom(this.http.post(`/api/v1/targets/${id}`, body));
      } else {
        await firstValueFrom(this.http.post('/api/v1/targets', body));
      }
      this.closeDialog();
      await this.refresh();
    } catch (e: unknown) {
      this.dialogError.set((e as { error?: { error?: string } })?.error?.error ?? 'Save failed');
    }
  }

  async deleteTarget(t: TargetRow): Promise<void> {
    if (!confirm(`Delete "${t.name}"? ${t.exercise_count > 0 ? `This will unlink ${t.exercise_count} exercise(s).` : ''}`)) return;
    await firstValueFrom(this.http.delete(`/api/v1/targets/${t.id}`));
    await this.refresh();
  }
}
