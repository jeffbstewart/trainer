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

interface TargetRow { id: number; name: string; category: string; exercise_count: number; }

@Component({
  selector: 'app-targets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <div class="header-row">
      <h2>Targets</h2>
      <button mat-flat-button color="primary" (click)="openDialog()">
        <mat-icon>add</mat-icon> New Target
      </button>
    </div>

    <mat-form-field appearance="outline" class="search-field">
      <mat-label>Search</mat-label>
      <mat-icon matPrefix>search</mat-icon>
      <input matInput (input)="applyFilter($any($event.target).value)" placeholder="Filter targets" />
    </mat-form-field>

    <table mat-table [dataSource]="dataSource" matSort class="target-table">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
        <td mat-cell *matCellDef="let t">
          <a [routerLink]="['/targets', t.id]">{{ t.name }}</a>
        </td>
      </ng-container>
      <ng-container matColumnDef="category">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Category</th>
        <td mat-cell *matCellDef="let t">{{ categoryLabel(t.category) }}</td>
      </ng-container>
      <ng-container matColumnDef="exercise_count">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Exercises</th>
        <td mat-cell *matCellDef="let t">{{ t.exercise_count }}</td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let t">
          <button mat-icon-button (click)="openDialog(t)" title="Edit"><mat-icon>edit</mat-icon></button>
          <button mat-icon-button (click)="deleteTarget(t)" title="Delete"><mat-icon>delete</mat-icon></button>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns;"></tr>
    </table>

    <mat-paginator [pageSizeOptions]="[10, 25, 50]" [pageSize]="25" showFirstLastButtons />

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
    .search-field { width: 100%; max-width: 400px; margin-bottom: 0.5rem; }
    .target-table { width: 100%; }
    .target-table a { color: var(--mat-sys-primary, #005cbb); text-decoration: none; }
    .target-table a:hover { text-decoration: underline; }
    .full-width { width: 100%; }
    .modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: var(--mat-sys-surface-container-high, #e9e7eb); color: var(--mat-sys-on-surface, #1a1b1f); border-radius: 12px; padding: 1.5rem; width: 90%; max-width: 400px;
      h3 { margin: 0 0 1rem; }
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
    .error-text { color: #f44336; font-size: 0.8125rem; }
  `,
})
export class TargetsComponent implements OnInit, AfterViewInit {
  private readonly http = inject(HttpClient);

  readonly sort = viewChild(MatSort);
  readonly paginator = viewChild(MatPaginator);
  readonly dataSource = new MatTableDataSource<TargetRow>([]);
  readonly columns = ['name', 'category', 'exercise_count', 'actions'];

  readonly dialogOpen = signal(false);
  readonly editId = signal<number | null>(null);
  readonly dialogName = signal('');
  readonly dialogCategory = signal('MUSCLE');
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
      const d = await firstValueFrom(this.http.get<{ targets: TargetRow[] }>('/api/v1/targets'));
      this.dataSource.data = d.targets;
    } catch { /* ignore */ }
  }

  applyFilter(value: string): void { this.dataSource.filter = value.trim().toLowerCase(); }

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
    if (!confirm(`Delete "${t.name}"?`)) return;
    try {
      await firstValueFrom(this.http.delete(`/api/v1/targets/${t.id}`));
      await this.refresh();
    } catch (err: unknown) {
      alert((err as { error?: { error?: string } })?.error?.error ?? 'Delete failed');
    }
  }
}
