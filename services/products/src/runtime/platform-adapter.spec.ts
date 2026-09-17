describe('adaptador HTTP do runtime', () => {
  it('mantém o adaptador Express disponível como dependência de produção', () => {
    expect(() => require.resolve('@nestjs/platform-express')).not.toThrow();
  });
});
