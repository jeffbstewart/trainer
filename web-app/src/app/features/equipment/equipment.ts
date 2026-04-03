import { Component, inject, signal, viewChild, OnInit, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

interface EquipmentRow { id: number; name: string; exercise_count: number; }

@Component({
  selector: 'app-equipment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="header-row">
      <h2>Equipment</h2>
      <button mat-flat-button color="primary" (click)="openDialog()">
        <mat-icon>add</mat-icon> New Equipment
      </button>
    </div>

    <mat-form-field appearance="outline" class="search-field">
      <mat-label>Search</mat-label>
      <mat-icon matPrefix>search</mat-icon>
      <input matInput (input)="applyFilter($any($event.target).value)" placeholder="Filter equipment" />
    </mat-form-field>

    <table mat-table [dataSource]="dataSource" matSort class="equip-table">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
        <td mat-cell *matCellDef="let e">{{ e.name }}</td>
      </ng-container>
      <ng-container matColumnDef="exercise_count">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Exercises</th>
        <td mat-cell *matCellDef="let e">{{ e.exercise_count }}</td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let e">
          <button mat-icon-button (click)="openDialog(e)" title="Edit"><mat-icon>edit</mat-icon></button>
          <button mat-icon-button (click)="deleteItem(e)" title="Delete"><mat-icon>delete</mat-icon></button>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns;"></tr>
    </table>

    <mat-paginator [pageSizeOptions]="[10, 25, 50]" [pageSize]="25" showFirstLastButtons />

    @if (dialogOpen()) {
      <div class="modal-overlay" (click)="closeDialog()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>{{ editId() ? 'Edit Equipment' : 'New Equipment' }}</h3>
          @if (dialogError()) { <p class="error-text">{{ dialogError() }}</p> }
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Name</mat-label>
            <input matInput [value]="dialogName()" (input)="dialogName.set($any($event.target).value)"
                   (keydown.enter)="save()" />
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
    .equip-table { width: 100%; }
    .full-width { width: 100%; }
    .modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: var(--mat-sys-surface-container-high, #e9e7eb); color: var(--mat-sys-on-surface, #1a1b1f); border-radius: 12px; padding: 1.5rem; width: 90%; max-width: 400px;
      h3 { margin: 0 0 1rem; }
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
    .error-text { color: #f44336; font-size: 0.8125rem; }
  `,
})
export class EquipmentComponent implements OnInit, AfterViewInit {
  private readonly http = inject(HttpClient);

  readonly sort = viewChild(MatSort);
  readonly paginator = viewChild(MatPaginator);
  readonly dataSource = new MatTableDataSource<EquipmentRow>([]);
  readonly columns = ['name', 'exercise_count', 'actions'];

  readonly dialogOpen = signal(false);
  readonly editId = signal<number | null>(null);
  readonly dialogName = signal('');
  readonly dialogError = signal('');

  async ngOnInit(): Promise<void> { await this.refresh(); }

  ngAfterViewInit(): void {
    const s = this.sort();
    const p = this.paginator();
    if (s) { this.dataSource.sort = s; s.active = 'name'; s.direction = 'asc'; }
    if (p) this.dataSource.paginator = p;
  }

  async refresh(): Promise<void> {
    try {
      const d = await firstValueFrom(this.http.get<{ equipment: EquipmentRow[] }>('/api/v1/equipment'));
      this.dataSource.data = d.equipment;
    } catch { /* ignore */ }
  }

  applyFilter(value: string): void { this.dataSource.filter = value.trim().toLowerCase(); }

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
    if (!confirm(`Delete "${e.name}"?`)) return;
    try {
      await firstValueFrom(this.http.delete(`/api/v1/equipment/${e.id}`));
      await this.refresh();
    } catch (err: unknown) {
      alert((err as { error?: { error?: string } })?.error?.error ?? 'Delete failed');
    }
  }
}
