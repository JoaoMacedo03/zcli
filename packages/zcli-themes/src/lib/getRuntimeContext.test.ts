import * as sinon from 'sinon'
import * as fs from 'fs'
import { expect, test } from '@oclif/test'
import { CliUx } from '@oclif/core'
import getRuntimeContext from './getRuntimeContext'

const baseFlags = {
  bind: 'localhost',
  port: 1000,
  logs: true,
  livereload: true,
  host: 'localhost'
}

const credentialFlags = {
  subdomain: 'z3n',
  username: 'admin@zendesk.com',
  password: '123456'
}

const flags = {
  ...baseFlags,
  ...credentialFlags
}

describe('getRuntimeContext', () => {
  beforeEach(() => {
    sinon.restore()
  })

  context('using CLI flags', () => {
    it('uses the flags to generate the context', async () => {
      const context = await getRuntimeContext('theme/path', flags)

      expect(context).to.deep.equal({
        bind: 'localhost',
        host: 'localhost',
        logs: true,
        livereload: true,
        origin: 'https://z3n.zendesk.com',
        port: 1000,
        subdomain: 'z3n',
        username: 'admin@zendesk.com',
        password: '123456'
      })
    })
  })

  context('using a zcli.themes.config.json file', () => {
    it('uses the config file to generate the context over the flags', async () => {
      const existsSyncStub = sinon.stub(fs, 'existsSync')
      const readFileSyncStub = sinon.stub(fs, 'readFileSync')

      existsSyncStub
        .withArgs('theme/path/zcli.themes.config.json')
        .returns(true)

      readFileSyncStub
        .withArgs('theme/path/zcli.themes.config.json')
        .returns(JSON.stringify({
          subdomain: 'z3n',
          username: 'admin@zendesk.com',
          password: '123456'
        }))

      const context = await getRuntimeContext('theme/path', baseFlags)

      expect(context).to.deep.equal({
        bind: 'localhost',
        host: 'localhost',
        logs: true,
        livereload: true,
        origin: 'https://z3n.zendesk.com',
        password: '123456',
        port: 1000,
        subdomain: 'z3n',
        username: 'admin@zendesk.com'
      })

      it('throws and error when the config file is malformed', () => {
        const existsSyncStub = sinon.stub(fs, 'existsSync')
        const readFileSyncStub = sinon.stub(fs, 'readFileSync')

        existsSyncStub
          .withArgs('theme/path/zcli.themes.config.json')
          .returns(true)

        readFileSyncStub
          .withArgs('theme/path/manifest.json')
          .returns('{"subdomain": "z3n",,,password: }')

        expect(async () => {
          await getRuntimeContext('theme/path', flags)
        }).to.throw('zcli configuration file was malformed at path: "theme/path/zcli.themes.config.json"')
      })
    })

    context('using the CLI prompt', () => {
      const promptStub = sinon.stub()

      test
        .do(() => {
          promptStub
            .withArgs('Account subdomain or full URL (including protocol)')
            .resolves('https://z3n.zendesk.com')
            .withArgs('Account username (email)')
            .resolves('another.admin@zendesk.com')
            .withArgs('Account password')
            .resolves('123')
        })
        .stub(CliUx.ux, 'prompt', () => promptStub)
        .it('should generate the context based on the prompt input', async () => {
          expect(await await getRuntimeContext('theme/path', baseFlags)).to.deep.equal({
            bind: 'localhost',
            host: 'localhost',
            logs: true,
            livereload: true,
            origin: 'https://z3n.zendesk.com',
            port: 1000,
            subdomain: 'https://z3n.zendesk.com',
            username: 'another.admin@zendesk.com',
            password: '123'
          })
        })
    })
  })
})
