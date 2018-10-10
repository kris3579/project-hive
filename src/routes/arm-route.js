'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const HttpError = require('http-errors');
const bcrypt = require('bcrypt');
const logger = require('../lib/logger');

// const MAS = require('../model/master-access-schema');
const AuthAccount = require('../model/auth-account-schema');
const queryUsers = require('../lib/queryUsers');

const jsonParser = bodyParser.json();
// this handles the hashing
const router = module.exports = new express.Router();

// development note: can make larger if needed, development system using 8
const HASH_ROUNDS = 8;
let accessCodeResult = false;

function hashAccessCode(code, callback) {
  const bcryptReturn = bcrypt.hashSync(code, HASH_ROUNDS);
  return callback(bcryptReturn);
}

function getHashCode(hashCode) {
  return hashCode;
}


const verifyAccessCode = (plainTextPassword, hashValue, callback) => {
  bcrypt.compare(plainTextPassword, hashValue, function (error, result) {
    // console.log('verifyAccessCode called');
    if (!result) {
      // console.log('unmatched result:');
      // console.log(result);
      callback(null, result);
    }
    if (result) {
      // console.log('matched result:');
      // console.log(result);
      accessCodeResult = true;
      callback(null, result);
    }
    // anything else callback error
    // callback(error);
  });
};

router.get('/arm/:id', jsonParser, (request, response, next) => {
  // ensure accessCodeResult is reset each time
  accessCodeResult = false;
  // store access code for param deletion
  let passedAccess = null;
  logger.log(logger.INFO, `Checking id for arm: ${request.params.id}`);
  if (!request.params.id) {
    logger.log(logger.INFO, 'no access code given.');
    return next(new HttpError(400, 'missing parameters'));
  }
  // else, store access code and delete param
  passedAccess = request.params.id;
  delete request.params.id;

  // hash incoming access code for compare
  const accessCodeHash = hashAccessCode(passedAccess, getHashCode);
  if (!accessCodeHash) {
    logger.log(logger.INFO, 'passcode failed hash failed.');
    return next(new HttpError(400, 'failed hash.'));
  }

  // define query for MAS (Master Access List)
  // const findMasterCodes = queryUsers.find(MAS, 'masterCodes');
  // let masterCodes = {};
  // queryUsers.query(findMasterCodes, (data) => {
  //   masterCodes = data;
  //   return data;
  // });
  // setTimeout(() => {
  //   console.log('masterCodes:');
  //   console.log(masterCodes);
  // }, 4000);

  // define query for AuthAccount
  const findStuff = queryUsers.find(AuthAccount, 'accessCodeHash');
  let accessCodes = {};
  // fill query container with AuthAccount data
  queryUsers.query(findStuff, function (data, error) {
    if (error) {
      return next(new HttpError(400, 'query error.'));
    }
    if (data) {
      accessCodes = data;
      // convert accessCodes into iterable array
      accessCodes = Object.values(accessCodes);
      for (let queryLength = 0; queryLength <= accessCodes.length - 1; queryLength++) {
        // console.log(queryLength);
        const checkHash = accessCodes[`${queryLength}`].accessCodeHash;
        verifyAccessCode(passedAccess, checkHash, function (err, test) {
          // console.log('test:');
          // console.log(test);
          if (err) {
            return next(new HttpError(400, 'accessCode error consult system admin.'));
          }
          if (test) {
            if (accessCodeResult === true) {
              // loop will keep checking until it's complete asyncronously... but...
              // as soon as it finds a match this is the only thread that will continue on in logic
              console.log('\nRun jason and kris\'s code\n');
              queryLength = accessCodes.length - 1;
              return response.json({ message: 'verified', accesscode: passedAccess, isValid: accessCodeResult });
            }
          }
          if (accessCodeResult !== true && queryLength === accessCodes.length - 1) {
            // console.log('queryLength = ' + queryLength);
            console.log('\nNo code runs...\n');
            return response.json({ message: 'bad access code', accesscode: passedAccess, isValid: accessCodeResult });
          }
          return undefined;
        });
        if (accessCodeResult) {
          break;
        }
      }
    }
    return undefined;
  });
  return undefined;
});