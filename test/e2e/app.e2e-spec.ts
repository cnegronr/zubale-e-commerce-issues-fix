import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from '../../src/app.controller';
import { AppService } from '../../src/app.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('should test ThrottlerExceptionFilter formatting', () => {
    const {
      ThrottlerExceptionFilter,
    } = require('../../src/common/filters/throttler-exception.filter');
    const filter = new ThrottlerExceptionFilter();
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockHeader = jest.fn();
    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ header: mockHeader, status: mockStatus }),
      }),
    } as any;
    const { ThrottlerException } = require('@nestjs/throttler');
    filter.catch(new ThrottlerException('Too Many Requests'), mockHost);
    expect(mockStatus).toHaveBeenCalledWith(429);
  });
});
