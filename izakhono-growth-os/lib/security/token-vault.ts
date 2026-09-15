import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedToken = {
  version:1;
  algorithm:"aes-256-gcm";
  iv:string;
  tag:string;
  ciphertext:string;
};

function getKey(){
  const raw=process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if(!raw) throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY is not configured.");
  const key=Buffer.from(raw,"base64");
  if(key.length!==32) throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

export function isTokenVaultReady(){
  try{return getKey().length===32;}catch{return false;}
}

export function encryptToken(plaintext:string):EncryptedToken{
  const key=getKey();
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",key,iv);
  const ciphertext=Buffer.concat([cipher.update(plaintext,"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return {
    version:1,
    algorithm:"aes-256-gcm",
    iv:iv.toString("base64"),
    tag:tag.toString("base64"),
    ciphertext:ciphertext.toString("base64")
  };
}

export function decryptToken(envelope:EncryptedToken){
  if(envelope.version!==1 || envelope.algorithm!=="aes-256-gcm"){
    throw new Error("Unsupported token envelope.");
  }
  const decipher=createDecipheriv("aes-256-gcm",getKey(),Buffer.from(envelope.iv,"base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag,"base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext,"base64")),
    decipher.final()
  ]).toString("utf8");
}
