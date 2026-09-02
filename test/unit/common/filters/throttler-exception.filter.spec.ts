import { ThrottlerExceptionFilter } from '../../../../src/common/filters/throttler-exception.filter';
import { ThrottlerException } from '@nestjs/throttler';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';

describe('ThrottlerExceptionFilter', () => {
  let filter: ThrottlerExceptionFilter;

  beforeEach(() => {
    filter = new ThrottlerExceptionFilter();
  });

  it('should catch ThrottlerException and format HTTP 429 response', () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockHeader = jest.fn();
    const mockResponse = {
      header: mockHeader,
      status: mockStatus,
    };

    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
      }),
    } as ArgumentsHost;

    const exception = new ThrottlerException('Too Many Requests');

    filter.catch(exception, mockHost);

    expect(mockHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Too Many Requests',
      }),
    );
  });
});
