import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.cache/**'] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      // El "ahora" se inyecta SIEMPRE. planonmap ha tenido la CI rota tres veces
      // por fechas fijas caducadas en fixtures; aquí no puede pasar.
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: 'Usa el reloj inyectado de src/core/clock.ts, no Date.now().',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Usa el reloj inyectado de src/core/clock.ts, no new Date().',
        },
      ],
      // Nadie sale a la red salvo el fetcher.
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Usa src/crawl/fetcher.ts: aplica robots.txt y límites.' },
      ],
    },
  },
  // Las dos excepciones a las reglas de arriba, y solo estas.
  {
    files: ['src/core/clock.ts', 'src/crawl/fetcher.ts'],
    rules: { 'no-restricted-syntax': 'off', 'no-restricted-globals': 'off' },
  },
  // Los propios archivos de configuración no están en el `include` de
  // tsconfig.json, así que el servicio de tipos no puede analizarlos: se
  // comprueban sin reglas con tipos, que es lo único que tiene sentido aquí.
  {
    files: ['*.config.mjs', '*.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Los tests construyen datos inválidos A PROPÓSITO para comprobar que el
  // esquema los rechaza. Exigirles tipos estrictos sería impedir esos tests.
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
)
