module.exports = {
    preset: 'jest-expo',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

    moduleNameMapper: {
        '\\.svg$': '<rootDir>/__mocks__/svgMock.js'
    }
};
