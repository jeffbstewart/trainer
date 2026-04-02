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

interface ProgramRow {
  id: number; name: string; sequence: string | null;
  trainee_id: number; trainee_name: string;
  started_at: string | null; ended_at: string | null; active: boolean;
}

interface TraineeRef { id: number; username: string; }

@Component({
  selector: 'app-programs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatTableModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <div class="header-row">
      <h2>Programs</h2>
      <button mat-flat-button color="primary" (click)="openCreate()">
        <mat-icon>add</mat-icon> New Program
      </button>
    </div>

    @if (programs().length > 0) {
      <table mat-table [dataSource]="programs()" class="program-table">
        <ng-container matColumnDef="sequence">
          <th mat-header-cell *matHeaderCellDef>#</th>
          <td mat-cell *matCellDef="let p">{{ p.sequence ?? '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Program</th>
          <td mat-cell *matCellDef="let p">
            <a [routerLink]="['/programs', p.id]">{{ p.name }}</a>
          </td>
        </ng-container>
        <ng-container matColumnDef="trainee">
          <th mat-header-cell *matHeaderCellDef>Client</th>
          <td mat-cell *matCellDef="let p">{{ p.trainee_name }}</td>
        </ng-container>
        <ng-container matColumnDef="started">
          <th mat-header-cell *matHeaderCellDef>Started</th>
          <td mat-cell *matCellDef="let p">{{ p.started_at ?? '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let p">
            <span class="status-badge" [class.active]="p.active">{{ p.active ? 'Active' : 'Ended' }}</span>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns;"></tr>
      </table>
    } @else {
      <p class="empty-text">No programs yet. Create one to start planning workouts for a client.</p>
    }

    @if (showCreate()) {
      <div class="modal-overlay" (click)="closeCreate()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>New Program</h3>
          @if (createError()) { <p class="error-text">{{ createError() }}</p> }
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Client</mat-label>
            <mat-select (selectionChange)="createTraineeId.set($event.value)">
              @for (t of trainees(); track t.id) {
                <mat-option [value]="t.id">{{ t.username }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Program Name</mat-label>
            <input matInput [value]="createName()" (input)="createName.set($any($event.target).value)"
                   placeholder="e.g. Spring 2026" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Sequence #</mat-label>
            <input matInput [value]="createSequence()" (input)="createSequence.set($any($event.target).value)"
                   placeholder="e.g. 12" />
          </mat-form-field>
          <div class="modal-actions">
            <button mat-stroked-button (click)="closeCreate()">Cancel</button>
            <button mat-flat-button color="primary"
                    [disabled]="!createName().trim() || !createTraineeId()"
                    (click)="submitCreate()">Create</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    h2 { margin: 0; }
    .program-table { width: 100%; }
    .program-table a { color: var(--mat-sys-primary, #005cbb); text-decoration: none; }
    .program-table a:hover { text-decoration: underline; }
    .status-badge { font-size: 0.6875rem; font-weight: 600; padding: 2px 8px; border-radius: 4px;
      background: rgba(150,150,150,0.15); color: rgba(150,150,150,1);
      &.active { background: rgba(76,175,80,0.15); color: #4caf50; }
    }
    .empty-text { opacity: 0.5; }
    .full-width { width: 100%; }
    .modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: var(--mat-sys-surface-container-high, #e9e7eb); color: var(--mat-sys-on-surface, #1a1b1f); border-radius: 12px; padding: 1.5rem; width: 90%; max-width: 450px;
      h3 { margin: 0 0 1rem; }
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
    .error-text { color: #f44336; font-size: 0.8125rem; }
  `,
})
export class ProgramsComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly programs = signal<ProgramRow[]>([]);
  readonly trainees = signal<TraineeRef[]>([]);
  readonly columns = ['sequence', 'name', 'trainee', 'started', 'status'];

  readonly showCreate = signal(false);
  readonly createName = signal('');
  readonly createSequence = signal('');
  readonly createTraineeId = signal<number | null>(null);
  readonly createError = signal('');

  async ngOnInit(): Promise<void> { await this.refresh(); }

  async refresh(): Promise<void> {
    try {
      const [programs, users] = await Promise.all([
        firstValueFrom(this.http.get<{ programs: ProgramRow[] }>('/api/v1/programs')),
        firstValueFrom(this.http.get<{ users: { id: number; username: string; access_level: number }[] }>('/api/v1/users')),
      ]);
      this.programs.set(programs.programs);
      this.trainees.set(users.users.filter(u => u.access_level === 1));
    } catch { /* ignore */ }
  }

  openCreate(): void {
    this.createName.set('');
    this.createSequence.set('');
    this.createTraineeId.set(null);
    this.createError.set('');
    this.showCreate.set(true);
  }

  closeCreate(): void { this.showCreate.set(false); }

  async submitCreate(): Promise<void> {
    this.createError.set('');
    try {
      await firstValueFrom(this.http.post('/api/v1/programs', {
        name: this.createName().trim(),
        trainee_id: this.createTraineeId(),
        sequence: this.createSequence().trim() || null,
      }));
      this.closeCreate();
      await this.refresh();
    } catch (e: unknown) {
      this.createError.set((e as { error?: { error?: string } })?.error?.error ?? 'Create failed');
    }
  }
}
