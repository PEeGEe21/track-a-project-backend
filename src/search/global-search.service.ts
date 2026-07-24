import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthorizationService } from 'src/common/authorization/authorization.service';
import { MessagesService } from 'src/messages/services/messages.service';
import { Document } from 'src/typeorm/entities/Document';
import { DocumentFile } from 'src/typeorm/entities/DocumentFile';
import { Note } from 'src/typeorm/entities/Note';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Resource } from 'src/typeorm/entities/Resource';
import { Task } from 'src/typeorm/entities/Task';
import { AuthUser } from 'src/types/users';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { In, Like, Repository } from 'typeorm';

export type GlobalSearchResult = {
  id: string;
  type: 'project' | 'task' | 'document' | 'note' | 'file' | 'message';
  title: string;
  snippet: string;
  href: string;
  project?: { id: number; title: string };
  updatedAt?: Date;
};

@Injectable()
export class GlobalSearchService {
  constructor(
    @InjectRepository(Project) private projects: Repository<Project>,
    @InjectRepository(ProjectPeer) private peers: Repository<ProjectPeer>,
    @InjectRepository(Task) private tasks: Repository<Task>,
    @InjectRepository(Document) private documents: Repository<Document>,
    @InjectRepository(Note) private notes: Repository<Note>,
    @InjectRepository(Resource) private resources: Repository<Resource>,
    @InjectRepository(DocumentFile)
    private documentFiles: Repository<DocumentFile>,
    private authorization: AuthorizationService,
    private messages: MessagesService,
  ) {}

  async search(actor: AuthUser, organizationId: string, rawQuery?: string) {
    const query = rawQuery?.trim() ?? '';
    if (query.length < 2) {
      throw new BadRequestException('Search query must contain at least 2 characters');
    }
    if (query.length > 100) {
      throw new BadRequestException('Search query cannot exceed 100 characters');
    }

    const accessibleProjects = await this.accessibleProjects(
      actor,
      organizationId,
    );
    const projectIds = accessibleProjects.map((project) => project.id);
    const term = `%${query}%`;
    const projectWhere = projectIds.length ? { id: In(projectIds) } : null;

    const [projects, tasks, documents, notes, files, documentFiles, messageResponse] =
      await Promise.all([
        projectWhere
          ? this.projects.find({
              where: [
                { ...projectWhere, organization_id: organizationId, title: Like(term) },
                {
                  ...projectWhere,
                  organization_id: organizationId,
                  description: Like(term),
                },
              ],
              order: { updated_at: 'DESC' },
              take: 8,
            })
          : [],
        projectIds.length
          ? this.tasks.find({
              where: [
                {
                  project: { id: In(projectIds) },
                  organization_id: organizationId,
                  title: Like(term),
                },
                {
                  project: { id: In(projectIds) },
                  organization_id: organizationId,
                  description: Like(term),
                },
              ],
              relations: ['project'],
              order: { updated_at: 'DESC' },
              take: 8,
            })
          : [],
        projectIds.length
          ? this.documents.find({
              where: [
                {
                  project: { id: In(projectIds) },
                  organization_id: organizationId,
                  title: Like(term),
                },
                {
                  project: { id: In(projectIds) },
                  organization_id: organizationId,
                  plainText: Like(term),
                },
              ],
              relations: ['project'],
              order: { updatedAt: 'DESC' },
              take: 8,
            })
          : [],
        this.notes.find({
          where: [
            {
              user: { id: actor.userId },
              organization_id: organizationId,
              note: Like(term),
            },
            {
              user: { id: actor.userId },
              organization_id: organizationId,
              audio_transcript: Like(term),
            },
          ],
          relations: ['project'],
          order: { updated_at: 'DESC' },
          take: 8,
        }),
        projectIds.length
          ? this.resources.find({
              where: [
                {
                  project: { id: In(projectIds) },
                  organization_id: organizationId,
                  title: Like(term),
                },
                {
                  project: { id: In(projectIds) },
                  organization_id: organizationId,
                  description: Like(term),
                },
              ],
              relations: ['project'],
              order: { updatedAt: 'DESC' },
              take: 8,
            })
          : [],
        projectIds.length
          ? this.documentFiles.find({
              where: [
                {
                  document: { project: { id: In(projectIds) } },
                  organization_id: organizationId,
                  originalName: Like(term),
                },
                {
                  document: { project: { id: In(projectIds) } },
                  organization_id: organizationId,
                  filename: Like(term),
                },
              ],
              relations: ['document', 'document.project'],
              order: { uploadedAt: 'DESC' },
              take: 8,
            })
          : [],
        this.messages.search(actor, organizationId, query),
      ]);

    const results: GlobalSearchResult[] = [
      ...projects.map((project) => ({
        id: String(project.id),
        type: 'project' as const,
        title: project.title,
        snippet: this.snippet(project.description, query),
        href: `/projects/${project.id}`,
        project: { id: project.id, title: project.title },
        updatedAt: project.updated_at,
      })),
      ...tasks.map((task) => ({
        id: String(task.id),
        type: 'task' as const,
        title: task.title,
        snippet: this.snippet(task.description, query),
        href: `/projects/${task.project.id}?tab=board&task=${task.id}`,
        project: { id: task.project.id, title: task.project.title },
        updatedAt: task.updated_at,
      })),
      ...documents.map((document) => ({
        id: document.id,
        type: 'document' as const,
        title: document.title,
        snippet: this.snippet(document.plainText, query),
        href: `/documents/${document.id}`,
        project: { id: document.project.id, title: document.project.title },
        updatedAt: document.updatedAt,
      })),
      ...notes.map((note) => ({
        id: String(note.id),
        type: 'note' as const,
        title: this.snippet(note.note, query, 70) || 'Note',
        snippet: this.snippet(note.audio_transcript || note.note, query),
        href: `/notes?note=${note.id}`,
        project: note.project
          ? { id: note.project.id, title: note.project.title }
          : undefined,
        updatedAt: note.updated_at,
      })),
      ...files.map((file) => ({
        id: String(file.id),
        type: 'file' as const,
        title: file.title,
        snippet: this.snippet(file.description || file.preview_description, query),
        href: `/projects/${file.project.id}?tab=resources`,
        project: { id: file.project.id, title: file.project.title },
        updatedAt: file.updatedAt,
      })),
      ...documentFiles.map((file) => ({
        id: file.id,
        type: 'file' as const,
        title: file.originalName || file.filename,
        snippet: `Attached to ${file.document.title}`,
        href: `/documents/${file.document.id}`,
        project: {
          id: file.document.project.id,
          title: file.document.project.title,
        },
        updatedAt: file.uploadedAt,
      })),
      ...(messageResponse.data?.messages ?? []).slice(0, 8).map((message) => ({
        id: String(message.id),
        type: 'message' as const,
        title: message.conversationName || 'Conversation message',
        snippet: message.snippet || this.snippet(message.content, query),
        href: `/chat?conversationId=${message.conversationId}&messageId=${message.id}`,
        updatedAt: message.createdAt,
      })),
    ];

    return {
      query,
      results,
      counts: results.reduce<Record<string, number>>((counts, result) => {
        counts[result.type] = (counts[result.type] ?? 0) + 1;
        return counts;
      }, {}),
    };
  }

  private async accessibleProjects(actor: AuthUser, organizationId: string) {
    const scope = await this.authorization.getProjectAccessScope(
      actor,
      organizationId,
    );
    if (scope.canAccessAllProjects) {
      return this.projects.find({ where: { organization_id: organizationId } });
    }
    const [owned, memberships] = await Promise.all([
      this.projects.find({
        where: {
          organization_id: organizationId,
          user: { id: scope.userId },
        },
      }),
      this.peers.find({
        where: {
          organization_id: organizationId,
          user: { id: scope.userId },
          status: ProjectPeerStatus.CONNECTED,
          is_confirmed: true,
        },
        relations: ['project'],
      }),
    ]);
    return [
      ...new Map(
        [...owned, ...memberships.map((membership) => membership.project)].map(
          (project) => [project.id, project],
        ),
      ).values(),
    ];
  }

  private snippet(value?: string | null, query = '', limit = 180) {
    const plain = String(value || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!plain) return '';
    const match = plain.toLowerCase().indexOf(query.toLowerCase());
    const start = match > 50 ? match - 50 : 0;
    const excerpt = plain.slice(start, start + limit);
    return `${start ? '…' : ''}${excerpt}${start + limit < plain.length ? '…' : ''}`;
  }
}
