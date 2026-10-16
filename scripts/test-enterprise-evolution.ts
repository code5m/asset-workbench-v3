import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { discoverEnterpriseWorkspace, freezeEnterpriseWorkspace } from '../server/enterpriseWorkspace.ts';
import { importEnterpriseRaw, verifyEnterpriseRaw } from '../server/enterpriseImport.ts';
import { mirrorEnterpriseSnapshot } from '../server/enterpriseMirror.ts';
import { buildEnterpriseMavenGraph } from '../server/enterpriseGraph.ts';
import { createEvolutionCase, advanceEvolutionCase, nominateFrameworkCandidate } from '../server/enterpriseEvolution.ts';

const parent=fs.mkdtempSync(path.join(os.tmpdir(),'awb-evo-e2e-'));
const git=(dir:string,...args:string[]) => execFileSync('git',['-C',dir,...args],{
  encoding:'utf8',env:{...process.env,GIT_AUTHOR_NAME:'Test',GIT_AUTHOR_EMAIL:'test@example.com',
    GIT_COMMITTER_NAME:'Test',GIT_COMMITTER_EMAIL:'test@example.com'},
  stdio:['ignore','pipe','pipe']}).trim();
const pom=(artifact:string,dep='')=>`<project><modelVersion>4.0.0</modelVersion><groupId>com.enterprise</groupId><artifactId>${artifact}</artifactId><version>1.0.0</version><dependencies>${dep}</dependencies></project>`;
try {
  for(const name of ['phantom-payment','phantom-operation']){
    const dir=path.join(parent,name);fs.mkdirSync(dir,{recursive:true});
    git(dir,'init','-q');
    fs.writeFileSync(path.join(dir,'pom.xml'),pom(name,name==='phantom-operation'?'<dependency><groupId>com.enterprise</groupId><artifactId>phantom-payment</artifactId></dependency>':''));
    git(dir,'add','.');git(dir,'commit','-qm','initial');
  }
  const discovery=discoverEnterpriseWorkspace(parent);
  assert.equal(discovery.repositories.length,2);
  const snap=freezeEnterpriseWorkspace(parent);
  const mirrors=mirrorEnterpriseSnapshot(parent,snap.snapshotId);
  assert.equal(mirrors.length,2);
  assert.ok(mirrors.every(m=>m.status==='verified'),JSON.stringify(mirrors));
  // An attacker-controlled or accidentally linked mirror must never allow Git
  // operations to write through into an independent company checkout.
  const mirror = mirrors[0].mirrorPath!;
  const companyPom = path.join(parent, mirrors[0].repository, 'pom.xml');
  const preserved = fs.readFileSync(companyPom);
  const symlink = path.join(mirror, 'objects', 'linked-company-file');
  fs.symlinkSync(companyPom, symlink);
  assert.equal(mirrorEnterpriseSnapshot(parent, snap.snapshotId)[0].status, 'blocked',
    'a nested mirror symlink must block fetch');
  assert.ok(fs.readFileSync(companyPom).equals(preserved));
  fs.unlinkSync(symlink);

  const hardlink = path.join(mirror, 'objects', 'hardlinked-company-file');
  fs.linkSync(companyPom, hardlink);
  assert.equal(mirrorEnterpriseSnapshot(parent, snap.snapshotId)[0].status, 'blocked',
    'a hard link from a company checkout must block mirror operations');
  fs.unlinkSync(hardlink);

  const alternate = path.join(mirror, 'objects', 'info', 'alternates');
  fs.mkdirSync(path.dirname(alternate), { recursive: true });
  fs.writeFileSync(alternate, path.join(parent, mirrors[0].repository, '.git', 'objects') + '\\n');
  assert.equal(mirrorEnterpriseSnapshot(parent, snap.snapshotId)[0].status, 'blocked',
    'external object alternates must not silently reference company Git data');
  fs.unlinkSync(alternate);

  const hook = path.join(mirror, 'hooks', 'reference-transaction');
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.writeFileSync(hook, '#!/bin/sh\\nexit 1\\n');
  assert.equal(mirrorEnterpriseSnapshot(parent, snap.snapshotId)[0].status, 'blocked',
    'a planted executable Git hook must block fetch');
  fs.unlinkSync(hook);
  assert.ok(mirrorEnterpriseSnapshot(parent, snap.snapshotId).every(m => m.status === 'verified'),
    'archive should recover after removing unsafe files');
  assert.ok(fs.readFileSync(companyPom).equals(preserved));

  const manifest=importEnterpriseRaw(parent,snap.snapshotId,{maxBytes:1024*1024});
  assert.equal(manifest.status,'verified');
  assert.equal(manifest.materialized,2);
  assert.equal(verifyEnterpriseRaw(parent,snap.snapshotId).ok,true);
  assert.equal(importEnterpriseRaw(parent,snap.snapshotId).manifestHash,manifest.manifestHash);
  const graph=buildEnterpriseMavenGraph(parent,snap.snapshotId);
  assert.equal(graph.modules.length,2);
  assert.equal(graph.edges.filter(e=>e.type==='maven-dependency').length,1);
  const evidence=[{repository:snap.repositories[0].path,path:'pom.xml',commit:snap.repositories[0].commit}];
  const item=createEvolutionCase(parent,{snapshotId:snap.snapshotId,title:'Dependency review',problem:'Cross-repo Maven risk',evidence});
  assert.equal(item.stage,'observed');
  assert.equal(createEvolutionCase(parent,{snapshotId:snap.snapshotId,title:'Dependency review',problem:'Cross-repo Maven risk',evidence}).id,item.id);
  assert.throws(()=>advanceEvolutionCase(parent,item.id,'promoted','premature'),/Invalid evolution transition/);
  assert.equal(advanceEvolutionCase(parent,item.id,'proposed','propose a change').stage,'proposed');
  assert.equal(advanceEvolutionCase(parent,item.id,'experimented','isolated evaluation').stage,'experimented');
  assert.equal(advanceEvolutionCase(parent,item.id,'verified','tests and evidence').stage,'verified');
  assert.throws(()=>advanceEvolutionCase(parent,item.id,'promoted','skip nomination'),/reviewed Framework candidate/);
  assert.equal(nominateFrameworkCandidate(parent,item.id).scope,'framework-candidate');
  assert.equal(advanceEvolutionCase(parent,item.id,'promoted','cross-workspace accepted').stage,'promoted');
  assert.equal(fs.existsSync(path.join(parent,'.asset-workbench-data')),false);
  console.log('ENTERPRISE_EVOLUTION_E2E PASS');
} finally { fs.rmSync(parent,{recursive:true,force:true}); }
