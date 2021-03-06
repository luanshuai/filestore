const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath = '../../../app/js/FileHandler.js'
const SandboxedModule = require('sandboxed-module')

chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))

describe('FileHandler', function() {
  let PersistorManager,
    LocalFileWriter,
    FileConverter,
    KeyBuilder,
    ImageOptimiser,
    FileHandler,
    fs
  const settings = {
    s3: {
      buckets: {
        user_files: 'user_files'
      }
    }
  }

  const bucket = 'my_bucket'
  const key = 'key/here'
  const convertedFolderKey = 'convertedFolder'
  const sourceStream = 'sourceStream'
  const convertedKey = 'convertedKey'
  const readStream = {
    stream: 'readStream',
    on: sinon.stub()
  }

  beforeEach(function() {
    PersistorManager = {
      promises: {
        getFileStream: sinon.stub().resolves(sourceStream),
        checkIfFileExists: sinon.stub().resolves(),
        deleteFile: sinon.stub().resolves(),
        deleteDirectory: sinon.stub().resolves(),
        sendStream: sinon.stub().resolves(),
        insertFile: sinon.stub().resolves(),
        sendFile: sinon.stub().resolves(),
        directorySize: sinon.stub().resolves()
      }
    }
    LocalFileWriter = {
      // the callback style is used for detached cleanup calls
      deleteFile: sinon.stub().yields(),
      promises: {
        writeStream: sinon.stub().resolves(),
        deleteFile: sinon.stub().resolves()
      }
    }
    FileConverter = {
      promises: {
        convert: sinon.stub().resolves(),
        thumbnail: sinon.stub().resolves(),
        preview: sinon.stub().resolves()
      }
    }
    KeyBuilder = {
      addCachingToKey: sinon.stub().returns(convertedKey),
      getConvertedFolderKey: sinon.stub().returns(convertedFolderKey)
    }
    ImageOptimiser = {
      promises: {
        compressPng: sinon.stub().resolves()
      }
    }
    fs = {
      createReadStream: sinon.stub().returns(readStream)
    }

    FileHandler = SandboxedModule.require(modulePath, {
      requires: {
        'settings-sharelatex': settings,
        './PersistorManager': PersistorManager,
        './LocalFileWriter': LocalFileWriter,
        './FileConverter': FileConverter,
        './KeyBuilder': KeyBuilder,
        './ImageOptimiser': ImageOptimiser,
        fs: fs
      },
      globals: { console }
    })
  })

  describe('insertFile', function() {
    const stream = 'stream'

    it('should send file to the filestore', function(done) {
      FileHandler.insertFile(bucket, key, stream, err => {
        expect(err).not.to.exist
        expect(PersistorManager.promises.sendStream).to.have.been.calledWith(
          bucket,
          key,
          stream
        )
        done()
      })
    })

    it('should delete the convertedKey folder', function(done) {
      FileHandler.insertFile(bucket, key, stream, err => {
        expect(err).not.to.exist
        expect(
          PersistorManager.promises.deleteDirectory
        ).to.have.been.calledWith(bucket, convertedFolderKey)
        done()
      })
    })
  })

  describe('deleteFile', function() {
    it('should tell the filestore manager to delete the file', function(done) {
      FileHandler.deleteFile(bucket, key, err => {
        expect(err).not.to.exist
        expect(PersistorManager.promises.deleteFile).to.have.been.calledWith(
          bucket,
          key
        )
        done()
      })
    })

    it('should tell the filestore manager to delete the cached folder', function(done) {
      FileHandler.deleteFile(bucket, key, err => {
        expect(err).not.to.exist
        expect(
          PersistorManager.promises.deleteDirectory
        ).to.have.been.calledWith(bucket, convertedFolderKey)
        done()
      })
    })
  })

  describe('getFile', function() {
    it('should return the source stream no format or style are defined', function(done) {
      FileHandler.getFile(bucket, key, null, (err, stream) => {
        expect(err).not.to.exist
        expect(stream).to.equal(sourceStream)
        done()
      })
    })

    it('should pass options through to PersistorManager', function(done) {
      const options = { start: 0, end: 8 }
      FileHandler.getFile(bucket, key, options, err => {
        expect(err).not.to.exist
        expect(PersistorManager.promises.getFileStream).to.have.been.calledWith(
          bucket,
          key,
          options
        )
        done()
      })
    })

    describe('when a format is defined', function() {
      let result

      describe('when the file is not cached', function() {
        beforeEach(function(done) {
          FileHandler.getFile(bucket, key, { format: 'png' }, (err, stream) => {
            result = { err, stream }
            done()
          })
        })

        it('should convert the file', function() {
          expect(FileConverter.promises.convert).to.have.been.called
        })

        it('should compress the converted file', function() {
          expect(ImageOptimiser.promises.compressPng).to.have.been.called
        })

        it('should return the the converted stream', function() {
          expect(result.err).not.to.exist
          expect(result.stream).to.equal(readStream)
          expect(
            PersistorManager.promises.getFileStream
          ).to.have.been.calledWith(bucket, key)
        })
      })

      describe('when the file is cached', function() {
        beforeEach(function(done) {
          PersistorManager.promises.checkIfFileExists = sinon
            .stub()
            .resolves(true)
          FileHandler.getFile(bucket, key, { format: 'png' }, (err, stream) => {
            result = { err, stream }
            done()
          })
        })

        it('should not convert the file', function() {
          expect(FileConverter.promises.convert).not.to.have.been.called
        })

        it('should not compress the converted file again', function() {
          expect(ImageOptimiser.promises.compressPng).not.to.have.been.called
        })

        it('should return the cached stream', function() {
          expect(result.err).not.to.exist
          expect(result.stream).to.equal(sourceStream)
          expect(
            PersistorManager.promises.getFileStream
          ).to.have.been.calledWith(bucket, convertedKey)
        })
      })
    })

    describe('when a style is defined', function() {
      it('generates a thumbnail when requested', function(done) {
        FileHandler.getFile(bucket, key, { style: 'thumbnail' }, err => {
          expect(err).not.to.exist
          expect(FileConverter.promises.thumbnail).to.have.been.called
          expect(FileConverter.promises.preview).not.to.have.been.called
          done()
        })
      })

      it('generates a preview when requested', function(done) {
        FileHandler.getFile(bucket, key, { style: 'preview' }, err => {
          expect(err).not.to.exist
          expect(FileConverter.promises.thumbnail).not.to.have.been.called
          expect(FileConverter.promises.preview).to.have.been.called
          done()
        })
      })
    })
  })

  describe('getDirectorySize', function() {
    it('should call the filestore manager to get directory size', function(done) {
      FileHandler.getDirectorySize(bucket, key, err => {
        expect(err).not.to.exist
        expect(PersistorManager.promises.directorySize).to.have.been.calledWith(
          bucket,
          key
        )
        done()
      })
    })
  })
})
