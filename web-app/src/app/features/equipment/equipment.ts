import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

interface EquipmentRow { id: number; name: string; exercise_count: number; }

@Component({
  selector: 'app-equipment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="header-row">
      <h2>Equipment</h2>
      <button mat-flat-button color="primary" (click)="openDialog()">
        <mat-icon>add</mat-icon> New Equipment
      </button>
    </div>

    <div class="equip-grid">
      @for (e of items(); track e.id) {
        <div class="equip-card">
          <span class="equip-name">{{ e.name }}</span>
          <span class="equip-count">{{ e.exercise_count }} exercise{{ e.exercise_count === 1 ? '' : 's' }}</span>
          <div class="equip-actions">
            <button mat-icon-button (click)="openDialog(e)" title="Edit"><mat-icon>edit</mat-icon></button>
            <button mat-icon-button (click)="deleteItem(e)" title="Delete"><mat-icon>delete</mat-icon></button>
          </div>
        </div>
      }
      @if (items().length === 0) {
        <p class="empty-text">No equipment yet. Add the gear your clients use.</p>
      }
    </div>

    @if (dialogOpen()) {
      <div class="modal-overlay" (click)="closeDialog()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>{{ editId() ? 'Edit Equipment' : 'New Equipment' }}</h3>
          @if (dialogError()) { <p class="error-text">{{ dialogError() }}</p> }
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Name</mat-label>
            <input matInput [value]="dialogName()" (input)="dialogName.set($any($event.target).value)" />
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
    .equip-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
    .equip-card {
      background: var(--mat-sys-surface-container, #efedf0); color: var(--mat-sys-on-surface, #1a1b1f);
      border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.25rem;
    }
    .equip-name { font-weight: 600; }
    .equip-count { font-size: 0.8125rem; opacity: 0.6; }
    .equip-actions { display: flex; gap: 0.25rem; margin-top: 0.25rem; }
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
export class EquipmentComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly items = signal<EquipmentRow[]>([]);
  readonly dialogOpen = signal(false);
  readonly editId = signal<number | null>(null);
  readonly dialogName = signal('');
  readonly dialogError = signal('');

  async ngOnInit(): Promise<void> { await this.refresh(); }

  async refresh(): Promise<void> {
    try {
      const d = await firstValueFrom(this.http.get<{ equipment: EquipmentRow[] }>('/api/v1/equipment'));
      this.items.set(d.equipment);
    } catch { /* ignore */ }
  }

  openDialog(existing?: EquipmentRow): void {
    this.editId.set(existing?.id ?? null);
    this.dialogName.set(existing?.name ?? '');
    this.dialogError.set('');
    this.dialogOpen.set(true);
  }

  closeDialog(): void { this.dialogOpen.set(false); }

  async save(): Promise<void> {
    this.dialogError.set('');
    try {
      const id = this.editId();
      if (id) {
        await firstValueFrom(this.http.post(`/api/v1/equipment/${id}`, { name: this.dialogName().trim() }));
      } else {
        await firstValueFrom(this.http.post('/api/v1/equipment', { name: this.dialogName().trim() }));
      }
      this.closeDialog();
      await this.refresh();
    } catch (e: unknown) {
      this.dialogError.set((e as { error?: { error?: string } })?.error?.error ?? 'Save failed');
    }
  }

  async deleteItem(e: EquipmentRow): Promise<void> {
    if (!confirm(`Delete "${e.name}"?${e.exercise_count > 0 ? ` This will unlink ${e.exercise_count} exercise(s).` : ''}`)) return;
    await firstValueFrom(this.http.delete(`/api/v1/equipment/${e.id}`));
    await this.refresh();
  }
}
