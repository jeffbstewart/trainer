import { Component, inject, signal, viewChild, OnInit, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Role } from '../../core/roles';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

interface UserRow {
  id: number; username: string; role: string; access_level: number;
  locked: boolean; must_change_password: boolean; trainer_id: number | null;
}

@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <div class="header-row">
      <h2>Users</h2>
      <button mat-flat-button color="primary" (click)="openCreate()">
        <mat-icon>add</mat-icon> New User
      </button>
    </div>

    <mat-form-field appearance="outline" class="search-field">
      <mat-label>Search</mat-label>
      <mat-icon matPrefix>search</mat-icon>
      <input matInput (input)="applyFilter($any($event.target).value)" placeholder="Filter by name or role" />
    </mat-form-field>

    <table mat-table [dataSource]="dataSource" matSort class="user-table">
      <ng-container matColumnDef="username">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Username</th>
        <td mat-cell *matCellDef="let u">
          <a [routerLink]="['/users', u.id]">{{ u.username }}</a>
          @if (u.locked) { <span class="badge locked">Locked</span> }
          @if (u.must_change_password) { <span class="badge pw">PW</span> }
        </td>
      </ng-container>
      <ng-container matColumnDef="role">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Role</th>
        <td mat-cell *matCellDef="let u">{{ u.role }}</td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let u">
          <a mat-icon-button [routerLink]="['/users', u.id]" title="View"><mat-icon>open_in_new</mat-icon></a>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns;"></tr>
    </table>

    <mat-paginator [pageSizeOptions]="[10, 25, 50]" [pageSize]="25" showFirstLastButtons />

    @if (showCreate()) {
      <div class="modal-overlay" (click)="closeCreate()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>New User</h3>
          @if (createError()) { <p class="error-text">{{ createError() }}</p> }
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Username</mat-label>
            <input matInput [value]="createUsername()" (input)="createUsername.set($any($event.target).value)" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Role</mat-label>
            <mat-select [value]="createRole()" (selectionChange)="createRole.set($event.value)">
              <mat-option [value]="1">Trainee</mat-option>
              <mat-option [value]="2">Trainer</mat-option>
              <mat-option [value]="3">Manager</mat-option>
            </mat-select>
          </mat-form-field>
          @if (createRole() === Role.TRAINEE && myAccessLevel() >= Role.MANAGER) {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Assign to Trainer</mat-label>
              <mat-select (selectionChange)="createTrainerId.set($event.value)">
                @for (t of trainers(); track t.id) {
                  <mat-option [value]="t.id">{{ t.username }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }
          @if (tempPassword()) {
            <div class="temp-pw-box">
              <p>Temporary password (shown once):</p>
              <code>{{ tempPassword() }}</code>
            </div>
            <button mat-flat-button (click)="closeCreate()">Done</button>
          } @else {
            <div class="modal-actions">
              <button mat-stroked-button (click)="closeCreate()">Cancel</button>
              <button mat-flat-button color="primary" [disabled]="!createUsername().trim()" (click)="submitCreate()">Create</button>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    h2 { margin: 0; }
    .search-field { width: 100%; max-width: 400px; margin-bottom: 0.5rem; }
    .user-table { width: 100%; }
    .user-table a { color: var(--mat-sys-primary, #005cbb); text-decoration: none; }
    .user-table a:hover { text-decoration: underline; }
    .badge { font-size: 0.5625rem; font-weight: 700; padding: 1px 5px; border-radius: 4px; margin-left: 0.375rem;
      &.locked { background: rgba(244,67,54,0.2); color: #f44336; }
      &.pw { background: rgba(255,165,0,0.2); color: #ffa500; }
    }
    .full-width { width: 100%; }
    .modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: var(--mat-sys-surface-container-high, #e9e7eb); color: var(--mat-sys-on-surface, #1a1b1f); border-radius: 12px; padding: 1.5rem; width: 90%; max-width: 400px;
      h3 { margin: 0 0 1rem; }
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
    .error-text { color: #f44336; font-size: 0.8125rem; }
    .temp-pw-box {
      background: rgba(76,175,80,0.15); border-radius: 8px; padding: 12px 16px; margin: 0.5rem 0 1rem;
      p { margin: 0 0 0.25rem; font-size: 0.8125rem; }
      code { font-size: 1.25rem; font-weight: 700; letter-spacing: 0.05em; }
    }
  `,
})
export class UsersComponent implements OnInit, AfterViewInit {
  private readonly http = inject(HttpClient);
  readonly Role = Role;

  readonly sort = viewChild(MatSort);
  readonly paginator = viewChild(MatPaginator);

  readonly dataSource = new MatTableDataSource<UserRow>([]);
  readonly columns = ['username', 'role', 'actions'];

  readonly myAccessLevel = signal(0);
  readonly trainers = signal<{ id: number; username: string }[]>([]);

  readonly showCreate = signal(false);
  readonly createUsername = signal('');
  readonly createRole = signal(1);
  readonly createTrainerId = signal<number | null>(null);
  readonly createError = signal('');
  readonly tempPassword = signal('');

  async ngOnInit(): Promise<void> { await this.refresh(); }

  ngAfterViewInit(): void {
    const s = this.sort();
    const p = this.paginator();
    if (s) this.dataSource.sort = s;
    if (p) this.dataSource.paginator = p;

    // Default sort by username ascending
    if (s) {
      s.active = 'username';
      s.direction = 'asc';
      s.sortChange.emit({ active: 'username', direction: 'asc' });
    }
  }

  async refresh(): Promise<void> {
    try {
      const [d, profile] = await Promise.all([
        firstValueFrom(this.http.get<{ users: UserRow[] }>('/api/v1/users')),
        firstValueFrom(this.http.get<{ access_level: number }>('/api/v1/profile')),
      ]);
      this.dataSource.data = d.users;
      this.myAccessLevel.set(profile.access_level);
      this.trainers.set(d.users.filter(u => u.access_level >= Role.TRAINER && u.access_level < Role.ADMIN));
    } catch { /* ignore */ }
  }

  applyFilter(value: string): void {
    this.dataSource.filter = value.trim().toLowerCase();
  }

  openCreate(): void {
    this.createUsername.set('');
    this.createRole.set(Role.TRAINEE);
    this.createTrainerId.set(null);
    this.createError.set('');
    this.tempPassword.set('');
    this.showCreate.set(true);
  }

  closeCreate(): void {
    this.showCreate.set(false);
    if (this.tempPassword()) this.refresh();
  }

  async submitCreate(): Promise<void> {
    this.createError.set('');
    try {
      const body: Record<string, unknown> = { username: this.createUsername().trim(), access_level: this.createRole() };
      if (this.createRole() === Role.TRAINEE && this.createTrainerId()) {
        body['trainer_id'] = this.createTrainerId();
      }
      const r = await firstValueFrom(this.http.post<{ ok?: boolean; temporary_password?: string; error?: string }>(
        '/api/v1/users', body));
      if (r.temporary_password) {
        this.tempPassword.set(r.temporary_password);
      } else {
        this.createError.set(r.error ?? 'Failed');
      }
    } catch (e: unknown) {
      this.createError.set((e as { error?: { error?: string } })?.error?.error ?? 'Request failed');
    }
  }
}
