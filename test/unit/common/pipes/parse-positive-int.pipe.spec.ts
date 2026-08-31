import { BadRequestException } from '@nestjs/common';
import { ParsePositiveIntPipe } from '../../../../src/common/pipes/parse-positive-int.pipe';

describe('ParsePositiveIntPipe', () => {
  let pipe: ParsePositiveIntPipe;

  beforeEach(() => {
    pipe = new ParsePositiveIntPipe();
  });

  it('should pass and return parsed number for valid positive integer string', () => {
    expect(pipe.transform('1')).toBe(1);
    expect(pipe.transform('100')).toBe(100);
  });

  it('should throw BadRequestException for 0', () => {
    expect(() => pipe.transform('0')).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for negative integer string', () => {
    expect(() => pipe.transform('-5')).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for non-numeric string', () => {
    expect(() => pipe.transform('invalid')).toThrow(BadRequestException);
  });
});
