import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Document } from 'src/typeorm/entities/Document';
import { DocumentFile } from 'src/typeorm/entities/DocumentFile';
import { Folder } from 'src/typeorm/entities/Folder';
import { UsersService } from 'src/users/services/users.service';

describe('DocumentsService', () => {
  let service: DocumentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: UsersService,
          useValue: { getUserAccountById: jest.fn() },
        },
        {
          provide: getRepositoryToken(Document),
          useValue: {},
        },
        {
          provide: getRepositoryToken(DocumentFile),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Folder),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
