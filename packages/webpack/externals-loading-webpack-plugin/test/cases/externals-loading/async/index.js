import { add } from 'foo';

const consoleInfoMock = vi.spyOn(console, 'info').mockImplementation(() =>
  undefined
);

consoleInfoMock.mockClear();

console.info(add(1, 2));

it('should log 3', () => {
  expect(consoleInfoMock).toBeCalledTimes(1);
  expect(consoleInfoMock).toBeCalledWith(3);
});
