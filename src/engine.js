/* BDAL Lab 4 Trainer — simulator engine (pure, no DOM).
 * Works in browser (globalThis.BDALEngine) and node (module.exports). */
(function (root) {
'use strict';

var WARN = 'WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable';

var WEATHER_CSV = [
  '2025-03-01, 32, 55, Clear', '2025-03-02, 28, 60, Partly Cloudy', '2025-03-03, 15, 70, Rain',
  '2025-03-04, 10, 75, Rain', '2025-03-05, 5, 80, Snow', '2025-03-06, 35, 50, Sunny',
  '2025-03-07, 38, 45, Heatwave', '2025-03-08, 12, 65, Cloudy', '2025-03-09, 8, 85, Snow',
  '2025-03-10, 25, 58, Clear', '2025-03-11, 20, 63, Drizzle', '2025-03-12, 30, 55, Sunny',
  '2025-03-13, 28, 57, Clear', '2025-03-14, 22, 60, Cloudy', '2025-03-15, 18, 67, Rain',
  '2025-03-16, 12, 70, Storm', '2025-03-17, 5, 90, Snow', '2025-03-18, 7, 80, Snow',
  '2025-03-19, 14, 75, Foggy', '2025-03-20, 30, 50, Sunny', '2025-03-21, 33, 45, Clear',
  '2025-03-22, 40, 40, Heatwave', '2025-03-23, 10, 80, Rain', '2025-03-24, 6, 85, Snow',
  '2025-03-25, 15, 70, Rain', '2025-03-26, 22, 65, Partly Cloudy', '2025-03-27, 35, 55, Clear',
  '2025-03-28, 18, 60, Drizzle', '2025-03-29, 25, 58, Cloudy', '2025-03-30, 30, 52, Sunny',
  '2025-03-31, 12, 75, Thunderstorm'
].join('\n');

var JAVA_SRC = '// WeatherDataProcessor.java — Mapper classifies each day, Reducer passes through (see lab folder)';

var STUDENTS_CSV = '1,John,18,A\n2,Alice,19,B\n3,Bob,17,A\n4,David,20,B';
var SCORES_CSV = '1,Math,85\n2,Math,78\n3,Science,90\n4,Math,88';
var SCRIPT_PIG = [
  "students = LOAD 'students.csv' USING PigStorage(',')",
  '    AS (student_id:int, name:chararray, age:int, grade:chararray);',
  '',
  "scores = LOAD 'scores.csv' USING PigStorage(',')",
  '    AS (student_id:int, subject:chararray, score:int);',
  '',
  'filtered_students = FILTER students BY age > 18;',
  'projected_students = FOREACH filtered_students GENERATE name, grade;',
  'sorted_students = ORDER projected_students BY name ASC;',
  'grouped_scores = GROUP scores BY subject;',
  'joined_data = JOIN students BY student_id, scores BY student_id;',
  '',
  'DUMP sorted_students;',
  'DUMP grouped_scores;',
  'DUMP joined_data;'
].join('\n');

function dir(children) { return { type: 'dir', children: children || {} }; }
function file(content) { return { type: 'file', content: content || '' }; }

function createState(os) {
  var local = dir();
  var cwd;
  if (os === 'windows') {
    local.children['C:'] = dir({
      BDA: dir({
        'command3.txt': file('this file moves into hdfs'),
        'exampleput.txt': file('uploaded with put'),
        'Weather.csv': file(WEATHER_CSV),
        'WeatherDataProcessor.java': file(JAVA_SRC)
      }),
      piglab: dir({
        'students.csv': file(STUDENTS_CSV),
        'scores.csv': file(SCORES_CSV),
        'script.pig': file(SCRIPT_PIG)
      })
    });
    cwd = ['C:', 'BDA'];
  } else {
    local.children['~'] = dir({
      kit: dir({
        'Lab-2-HDFS-Basic-Commands': dir({
          'command3.txt': file('this file moves into hdfs'),
          'exampleput.txt': file('uploaded with put')
        })
      }),
      weather: dir({
        'WeatherDataProcessor.java': file(JAVA_SRC),
        'Weather.csv': file(WEATHER_CSV)
      }),
      piglab: dir({
        'students.csv': file(STUDENTS_CSV),
        'scores.csv': file(SCORES_CSV),
        'script.pig': file(SCRIPT_PIG)
      })
    });
    cwd = ['~'];
  }
  return {
    os: os,
    clusterUp: false,
    hdfs: dir({ tmp: dir(), user: dir() }),
    local: local,
    cwd: cwd,
    compiled: false,
    jarBuilt: false,
    jobRuns: 0,
    pids: null,
    pidSeed: 4100
  };
}

// ---------- helpers ----------

function tokenize(input) {
  var tokens = [], cur = '', q = null;
  for (var i = 0; i < input.length; i++) {
    var c = input[i];
    if (q) {
      if (c === q) { q = null; } else { cur += c; }
    } else if (c === '"' || c === "'") {
      q = c;
    } else if (/\s/.test(c)) {
      if (cur) { tokens.push(cur); cur = ''; }
    } else {
      cur += c;
    }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

function ok(output) { return { output: output, ok: true }; }
function err(output) { return { output: output, ok: false }; }

function isUnix(state) { return state.os !== 'windows'; }

// local path -> array of segments from local root, or null if malformed
function localSegs(state, p) {
  p = p.replace(/\\/g, '/');
  var segs;
  if (/^[A-Za-z]:/.test(p)) {
    segs = p.split('/').filter(Boolean);
    segs[0] = segs[0].toUpperCase();
  } else if (p === '~' || p.indexOf('~/') === 0) {
    segs = ['~'].concat(p.slice(2).split('/').filter(Boolean));
  } else if (p.indexOf('/') === 0) {
    // absolute unix path — map /home-ish onto '~' root for simplicity
    segs = ['~'].concat(p.split('/').filter(Boolean));
  } else {
    segs = state.cwd.concat(p.split('/').filter(Boolean));
  }
  var out = [];
  for (var i = 0; i < segs.length; i++) {
    if (segs[i] === '.') continue;
    else if (segs[i] === '..') out.pop();
    else out.push(segs[i]);
  }
  return out;
}

function getNode(rootDir, segs) {
  var node = rootDir;
  for (var i = 0; i < segs.length; i++) {
    if (!node || node.type !== 'dir') return null;
    node = node.children[segs[i]];
  }
  return node || null;
}

function hdfsSegs(p) {
  if (p.indexOf('/') !== 0) p = '/user/student/' + p;
  return p.split('/').filter(Boolean);
}

function hdfsPathStr(segs) { return '/' + segs.join('/'); }

function cwdString(state) {
  if (isUnix(state)) return state.cwd.join('/');
  return state.cwd[0] + '\\' + state.cwd.slice(1).join('\\');
}

// ---------- cluster ----------

var UNIX_DAEMONS = ['NameNode', 'DataNode', 'SecondaryNameNode', 'ResourceManager', 'NodeManager'];
var WIN_DAEMONS = ['NameNode', 'DataNode', 'ResourceManager', 'NodeManager'];

function startCluster(state) {
  if (state.clusterUp) return ok('cluster is already running (check with: jps)');
  state.clusterUp = true;
  var daemons = isUnix(state) ? UNIX_DAEMONS : WIN_DAEMONS;
  state.pids = {};
  var pid = state.pidSeed;
  for (var i = 0; i < daemons.length; i++) {
    pid += 137 + i * 11;
    state.pids[daemons[i]] = pid;
  }
  if (isUnix(state)) {
    return ok('Starting namenodes on [localhost]\nStarting datanodes\nStarting secondary namenodes [localhost]\nStarting resourcemanager\nStarting nodemanagers');
  }
  return ok('starting namenode, logging to console window\nstarting datanode, logging to console window\nstarting yarn daemons\n(4 new console windows opened — leave them open, closing one kills that daemon)');
}

function stopCluster(state) {
  if (!state.clusterUp) return ok('cluster is not running');
  state.clusterUp = false;
  state.pids = null;
  return ok(isUnix(state)
    ? 'Stopping namenodes on [localhost]\nStopping datanodes\nStopping secondary namenodes [localhost]\nStopping resourcemanager\nStopping nodemanagers'
    : 'stopping namenode\nstopping datanode\nstopping yarn daemons');
}

function jps(state) {
  state.pidSeed += 7;
  var lines = [];
  if (state.clusterUp) {
    var names = Object.keys(state.pids);
    for (var i = 0; i < names.length; i++) lines.push(state.pids[names[i]] + ' ' + names[i]);
  }
  lines.push((state.pidSeed + 900) + ' Jps');
  return ok(lines.join('\n'));
}

// ---------- fs (hadoop fs / hdfs dfs) ----------

function connRefused(verb) {
  return err(verb + ': Call From localhost to localhost:9000 failed on connection exception: ' +
    'java.net.ConnectException: Connection refused; For more details see:  http://wiki.apache.org/hadoop/ConnectionRefused\n' +
    '(hint: the cluster is not running — nothing is broken)');
}

function lsEntryLine(name, node, pathPrefix) {
  var full = (pathPrefix === '/' ? '' : pathPrefix) + '/' + name;
  if (node.type === 'dir') {
    return 'drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 ' + full;
  }
  var size = String(node.content.length);
  var pad = '';
  for (var i = size.length; i < 10; i++) pad += ' ';
  return '-rw-r--r--   1 student supergroup ' + pad + size + ' 2026-07-28 10:00 ' + full;
}

function fsCmd(state, args, family) {
  if (!args.length) return err('Usage: ' + family + ' -<command> [args]');
  var sub = args[0];
  var verb = sub.replace(/^-+/, '');
  if (!state.clusterUp) {
    var known = ['-ls', '-mkdir', '-copyFromLocal', '-put', '-copyToLocal', '-get', '-cat', '-rm', '-rmdir',
      '-mv', '-cp', '-du', '-tail', '-touchz', '-count'];
    if (known.indexOf(sub) !== -1) return connRefused(verb);
  }
  var rest = args.slice(1);
  switch (sub) {
    case '-ls': return fsLs(state, rest);
    case '-mkdir': return fsMkdir(state, rest);
    case '-copyFromLocal':
    case '-put': return fsPut(state, rest, verb);
    case '-copyToLocal':
    case '-get': return fsGet(state, rest, verb);
    case '-cat': return fsCat(state, rest);
    case '-rm': return fsRm(state, rest);
    case '-rmdir': return fsRmdir(state, rest);
    case '-mv':
    case '-cp': return fsMvCp(state, rest, verb);
    case '-du': return fsDu(state, rest);
    case '-tail': return fsTail(state, rest);
    case '-touchz': return fsTouchz(state, rest);
    case '-count': return fsCount(state, rest);
    default:
      return err(sub + ': Unknown command');
  }
}

function cloneNode(node) { return JSON.parse(JSON.stringify(node)); }

function fsMvCp(state, rest, verb) {
  var fp = flagsAndPaths(rest);
  if (fp.paths.length < 2) return err('-' + verb + ': Not enough arguments');
  var srcSegs = hdfsSegs(fp.paths[0]);
  var srcNode = getNode(state.hdfs, srcSegs);
  if (!srcNode) return err(verb + ': `' + hdfsPathStr(srcSegs) + "': No such file or directory");
  var dstSegs = hdfsSegs(fp.paths[1]);
  var dstNode = getNode(state.hdfs, dstSegs);
  var parent, finalName;
  if (dstNode && dstNode.type === 'dir') { parent = dstNode; finalName = srcSegs[srcSegs.length - 1]; }
  else if (dstNode) { return err(verb + ': `' + hdfsPathStr(dstSegs) + "': File exists"); }
  else {
    parent = getNode(state.hdfs, dstSegs.slice(0, -1));
    if (!parent || parent.type !== 'dir') return err(verb + ': `' + hdfsPathStr(dstSegs) + "': No such file or directory");
    finalName = dstSegs[dstSegs.length - 1];
  }
  parent.children[finalName] = cloneNode(srcNode);
  if (verb === 'mv') {
    var srcParent = getNode(state.hdfs, srcSegs.slice(0, -1));
    delete srcParent.children[srcSegs[srcSegs.length - 1]];
  }
  return ok(WARN);
}

function sumSize(node) {
  if (node.type === 'file') return node.content.length;
  var total = 0;
  for (var k in node.children) total += sumSize(node.children[k]);
  return total;
}

function humanSize(n) {
  if (n < 1024) return String(n);
  return (n / 1024).toFixed(1) + ' K';
}

function fsDu(state, rest) {
  var fp = flagsAndPaths(rest);
  var human = fp.flags.indexOf('-h') !== -1;
  var p = fp.paths[0] || '/user/student';
  var segs = hdfsSegs(p);
  var node = getNode(state.hdfs, segs);
  if (!node) return err('du: `' + hdfsPathStr(segs) + "': No such file or directory");
  var out = [WARN];
  var entries = node.type === 'dir' ? Object.keys(node.children).sort() : [null];
  for (var i = 0; i < entries.length; i++) {
    var child = entries[i] === null ? node : node.children[entries[i]];
    var full = entries[i] === null ? hdfsPathStr(segs) : hdfsPathStr(segs) + '/' + entries[i];
    var size = sumSize(child);
    var shown = human ? humanSize(size) : String(size);
    out.push(shown + '  ' + shown + '  ' + full);
  }
  return ok(out.join('\n'));
}

function fsTail(state, rest) {
  var fp = flagsAndPaths(rest);
  if (!fp.paths.length) return err('-tail: Not enough arguments');
  var segs = hdfsSegs(fp.paths[0]);
  var node = getNode(state.hdfs, segs);
  if (!node) return err('tail: `' + hdfsPathStr(segs) + "': No such file or directory");
  if (node.type === 'dir') return err('tail: `' + hdfsPathStr(segs) + "': Is a directory");
  var content = node.content;
  var tail = content.length > 1024 ? content.slice(content.length - 1024) : content;
  return ok(WARN + '\n' + tail);
}

function fsTouchz(state, rest) {
  var fp = flagsAndPaths(rest);
  if (!fp.paths.length) return err('-touchz: Not enough arguments');
  var segs = hdfsSegs(fp.paths[0]);
  var existing = getNode(state.hdfs, segs);
  if (existing && existing.type === 'dir') return err('touchz: `' + hdfsPathStr(segs) + "': Is a directory");
  var parent = getNode(state.hdfs, segs.slice(0, -1));
  if (!parent || parent.type !== 'dir') return err('touchz: `' + hdfsPathStr(segs) + "': No such file or directory");
  parent.children[segs[segs.length - 1]] = file('');
  return ok(WARN);
}

function countDirs(node) {
  if (node.type !== 'dir') return 0;
  var n = 1;
  for (var k in node.children) n += countDirs(node.children[k]);
  return n;
}
function countFiles(node) {
  if (node.type === 'file') return 1;
  var n = 0;
  for (var k in node.children) n += countFiles(node.children[k]);
  return n;
}

function fsCount(state, rest) {
  var fp = flagsAndPaths(rest);
  var p = fp.paths[0] || '/user/student';
  var segs = hdfsSegs(p);
  var node = getNode(state.hdfs, segs);
  if (!node) return err('count: `' + hdfsPathStr(segs) + "': No such file or directory");
  return ok(WARN + '\n' +
    '           ' + countDirs(node) + '            ' + countFiles(node) + '                 ' + sumSize(node) + ' ' + hdfsPathStr(segs));
}

function flagsAndPaths(rest) {
  var flags = [], paths = [];
  for (var i = 0; i < rest.length; i++) {
    if (rest[i].indexOf('-') === 0 && !/^-?\/|^-?[A-Za-z]:/.test(rest[i])) flags.push(rest[i]);
    else paths.push(rest[i]);
  }
  return { flags: flags, paths: paths };
}

function fsMkdir(state, rest) {
  var fp = flagsAndPaths(rest);
  if (!fp.paths.length) return err('-mkdir: Not enough arguments');
  var withP = fp.flags.indexOf('-p') !== -1;
  for (var i = 0; i < fp.paths.length; i++) {
    var segs = hdfsSegs(fp.paths[i]);
    var shown = hdfsPathStr(segs);
    if (getNode(state.hdfs, segs)) return err('mkdir: `' + shown + "': File exists");
    var parent = getNode(state.hdfs, segs.slice(0, -1));
    if (!parent || parent.type !== 'dir') {
      if (!withP) return err('mkdir: `' + shown + "': No such file or directory");
      parent = state.hdfs;
      for (var j = 0; j < segs.length - 1; j++) {
        if (!parent.children[segs[j]]) parent.children[segs[j]] = dir();
        parent = parent.children[segs[j]];
      }
    }
    parent.children[segs[segs.length - 1]] = dir();
  }
  return ok(WARN);
}

function fsPut(state, rest, verb) {
  var fp = flagsAndPaths(rest);
  var force = fp.flags.indexOf('-f') !== -1;
  if (fp.paths.length < 2) return err('-' + verb + ': Not enough arguments');
  var srcPath = fp.paths[0], dstPath = fp.paths[1];
  if (/\s/.test(srcPath)) return err(verb + ': unexpected URISyntaxException');
  var srcSegs = localSegs(state, srcPath);
  var srcNode = getNode(state.local, srcSegs);
  if (!srcNode || srcNode.type !== 'file') {
    return err(verb + ": `" + srcPath + "': No such file or directory");
  }
  var name = srcSegs[srcSegs.length - 1];
  var dstSegs = hdfsSegs(dstPath);
  var dstNode = getNode(state.hdfs, dstSegs);
  var parent, finalName;
  if (dstNode && dstNode.type === 'dir') { parent = dstNode; finalName = name; }
  else if (dstNode && dstNode.type === 'file') {
    if (!force) return err(verb + ': `' + hdfsPathStr(dstSegs) + "': File exists");
    parent = getNode(state.hdfs, dstSegs.slice(0, -1)); finalName = dstSegs[dstSegs.length - 1];
  } else {
    parent = getNode(state.hdfs, dstSegs.slice(0, -1));
    if (!parent || parent.type !== 'dir') return err(verb + ': `' + hdfsPathStr(dstSegs) + "': No such file or directory");
    finalName = dstSegs[dstSegs.length - 1];
  }
  if (parent.children[finalName] && !force) {
    return err(verb + ': `' + hdfsPathStr(dstSegs) + '/' + finalName + "': File exists");
  }
  parent.children[finalName] = file(srcNode.content);
  return ok(WARN);
}

function fsGet(state, rest, verb) {
  var fp = flagsAndPaths(rest);
  if (fp.paths.length < 2) return err('-' + verb + ': Not enough arguments');
  var srcSegs = hdfsSegs(fp.paths[0]);
  var srcNode = getNode(state.hdfs, srcSegs);
  var errVerb = verb === 'copyToLocal' ? 'copyToLocal' : 'get';
  if (!srcNode || srcNode.type !== 'file') {
    return err(errVerb + ': `' + hdfsPathStr(srcSegs) + "': No such file or directory");
  }
  var name = srcSegs[srcSegs.length - 1];
  var dstPath = fp.paths[1];
  var dstSegs = localSegs(state, dstPath === '.' ? '.' : dstPath);
  var dstNode = getNode(state.local, dstSegs);
  var parent, finalName;
  if (dstNode && dstNode.type === 'dir') { parent = dstNode; finalName = name; }
  else {
    parent = getNode(state.local, dstSegs.slice(0, -1));
    if (!parent || parent.type !== 'dir') return err(errVerb + ': `' + dstPath + "': No such file or directory");
    finalName = dstSegs[dstSegs.length - 1];
  }
  parent.children[finalName] = file(srcNode.content);
  return ok(WARN);
}

function fsCat(state, rest) {
  var fp = flagsAndPaths(rest);
  if (!fp.paths.length) return err('-cat: Not enough arguments');
  var out = [WARN];
  for (var i = 0; i < fp.paths.length; i++) {
    var segs = hdfsSegs(fp.paths[i]);
    var node = getNode(state.hdfs, segs);
    if (!node) return err('cat: `' + hdfsPathStr(segs) + "': No such file or directory");
    if (node.type === 'dir') return err('cat: `' + hdfsPathStr(segs) + "': Is a directory");
    out.push(node.content);
  }
  return ok(out.join('\n'));
}

function fsRm(state, rest) {
  var fp = flagsAndPaths(rest);
  var recursive = fp.flags.indexOf('-r') !== -1 || fp.flags.indexOf('-R') !== -1;
  if (!fp.paths.length) return err('-rm: Not enough arguments');
  var out = [WARN];
  for (var i = 0; i < fp.paths.length; i++) {
    var segs = hdfsSegs(fp.paths[i]);
    var shown = hdfsPathStr(segs);
    var node = getNode(state.hdfs, segs);
    if (!node) return err('rm: `' + shown + "': No such file or directory");
    if (node.type === 'dir' && !recursive) return err('rm: `' + shown + "': Is a directory");
    var parent = getNode(state.hdfs, segs.slice(0, -1));
    delete parent.children[segs[segs.length - 1]];
    out.push('Deleted ' + shown);
  }
  return ok(out.join('\n'));
}

function fsRmdir(state, rest) {
  var fp = flagsAndPaths(rest);
  if (!fp.paths.length) return err('-rmdir: Not enough arguments');
  var segs = hdfsSegs(fp.paths[0]);
  var shown = hdfsPathStr(segs);
  var node = getNode(state.hdfs, segs);
  if (!node) return err('rmdir: `' + shown + "': No such file or directory");
  if (node.type !== 'dir') return err('rmdir: `' + shown + "': Is not a directory");
  if (Object.keys(node.children).length) return err('rmdir: `' + shown + "': Directory is not empty");
  var parent = getNode(state.hdfs, segs.slice(0, -1));
  delete parent.children[segs[segs.length - 1]];
  return ok(WARN);
}

function fsLs(state, rest) {
  var p = rest.filter(function (a) { return a.indexOf('-') !== 0; })[0] || '/user/student';
  var segs = hdfsSegs(p);
  var node = getNode(state.hdfs, segs);
  var shown = hdfsPathStr(segs);
  if (!node) return err('ls: `' + shown + "': No such file or directory");
  var out = [WARN];
  if (node.type === 'file') {
    out.push(lsEntryLine(segs[segs.length - 1], node, hdfsPathStr(segs.slice(0, -1)) || '/'));
    return ok(out.join('\n'));
  }
  var names = Object.keys(node.children).sort();
  out.push('Found ' + names.length + ' items');
  for (var i = 0; i < names.length; i++) {
    out.push(lsEntryLine(names[i], node.children[names[i]], shown === '/' ? '/' : shown));
  }
  return ok(out.join('\n'));
}

// ---------- local commands ----------

function localLs(state) {
  var node = getNode(state.local, state.cwd);
  var names = Object.keys(node.children).sort();
  return ok(names.join('\n'));
}

function localCd(state, p) {
  if (!p) { state.cwd = isUnix(state) ? ['~'] : ['C:', 'BDA']; return ok(''); }
  var segs = localSegs(state, p);
  var node = getNode(state.local, segs);
  if (!node || node.type !== 'dir') return err('cd: no such file or directory: ' + p);
  state.cwd = segs;
  return ok('');
}

function localMkdir(state, args) {
  var paths = args.filter(function (a) { return a.indexOf('-') !== 0; });
  if (!paths.length) return err('mkdir: missing operand');
  for (var i = 0; i < paths.length; i++) {
    var segs = localSegs(state, paths[i]);
    var parent = getNode(state.local, segs.slice(0, -1));
    if (!parent || parent.type !== 'dir') {
      if (args.indexOf('-p') === -1) return err('mkdir: cannot create directory ‘' + paths[i] + '’: No such file or directory');
      // -p: create the chain
      parent = state.local;
      for (var j = 0; j < segs.length - 1; j++) {
        if (!parent.children[segs[j]]) parent.children[segs[j]] = dir();
        parent = parent.children[segs[j]];
      }
    }
    if (!parent.children[segs[segs.length - 1]]) parent.children[segs[segs.length - 1]] = dir();
  }
  return ok('');
}

// ---------- Lab 4 toolchain (weather job) ----------

var CLASSPATH = '/opt/hadoop/etc/hadoop:/opt/hadoop/share/hadoop/common/lib/*:/opt/hadoop/share/hadoop/common/*:/opt/hadoop/share/hadoop/hdfs/*:/opt/hadoop/share/hadoop/mapreduce/*:/opt/hadoop/share/hadoop/yarn/*';

var WEATHER_PART = [
  '2025-03-01\tHot Day', '2025-03-02\tModerate Weather', '2025-03-03\tRainy Day',
  '2025-03-04\tRainy Day', '2025-03-05\tSnowy Day', '2025-03-06\tHot Day',
  '2025-03-07\tHot Day', '2025-03-08\tModerate Weather', '2025-03-09\tSnowy Day',
  '2025-03-10\tModerate Weather', '2025-03-11\tModerate Weather', '2025-03-12\tHot Day',
  '2025-03-13\tModerate Weather', '2025-03-14\tModerate Weather', '2025-03-15\tRainy Day',
  '2025-03-16\tStormy Weather - Stay Safe!', '2025-03-17\tSnowy Day', '2025-03-18\tSnowy Day',
  '2025-03-19\tModerate Weather', '2025-03-20\tHot Day', '2025-03-21\tHot Day',
  '2025-03-22\tHot Day', '2025-03-23\tRainy Day', '2025-03-24\tSnowy Day',
  '2025-03-25\tRainy Day', '2025-03-26\tModerate Weather', '2025-03-27\tHot Day',
  '2025-03-28\tModerate Weather', '2025-03-29\tModerate Weather', '2025-03-30\tHot Day',
  '2025-03-31\tStormy Weather - Stay Safe!'
].join('\n');

function javac(state, args) {
  var srcName = null;
  for (var i = 0; i < args.length; i++) {
    if (/\.java$/.test(args[i])) srcName = args[i];
  }
  if (!srcName) return err('javac: no source files');
  var hasCp = args.indexOf('-classpath') !== -1 || args.indexOf('-cp') !== -1;
  if (!hasCp) {
    return err('WeatherDataProcessor.java:1: error: package org.apache.hadoop.conf does not exist\n' +
      '(hint: compile against Hadoop’s jars with  -classpath "$(hadoop classpath)")');
  }
  var segs = localSegs(state, srcName);
  var node = getNode(state.local, segs);
  if (!node || node.type !== 'file') return err('javac: file not found: ' + srcName);
  var cwdNode = getNode(state.local, state.cwd);
  cwdNode.children['WeatherDataProcessor.class'] = file('<bytecode>');
  cwdNode.children['WeatherDataProcessor$WeatherMapper.class'] = file('<bytecode>');
  cwdNode.children['WeatherDataProcessor$WeatherReducer.class'] = file('<bytecode>');
  state.compiled = true;
  return ok('');
}

function jarTool(state, args) {
  if (!args.length || args[0].indexOf('-c') !== 0) return err('jar: bad or missing flags (use: jar -cf WeatherDataProcessor.jar *.class)');
  if (!state.compiled) return err('jar: no .class files found — compile first with javac');
  var jarName = null;
  for (var i = 0; i < args.length; i++) {
    if (/\.jar$/.test(args[i])) jarName = args[i];
  }
  if (!jarName) return err('jar: no output jar name given');
  var cwdNode = getNode(state.local, state.cwd);
  cwdNode.children[jarName.split('/').pop()] = file('<jar>');
  state.jarBuilt = true;
  var verbose = args[0].indexOf('v') !== -1;
  return ok(verbose
    ? 'added manifest\nadding: WeatherDataProcessor.class\nadding: WeatherDataProcessor$WeatherMapper.class\nadding: WeatherDataProcessor$WeatherReducer.class'
    : '');
}

function hadoopJar(state, args) {
  if (args.length < 4) return err('Usage: hadoop jar <jar> <mainClass> <input> <output>');
  var jarName = args[0], mainClass = args[1], inPath = args[2], outPath = args[3];
  if (!state.clusterUp) return connRefused('mapreduce');
  var jarNode = getNode(state.local, localSegs(state, jarName));
  if (!jarNode || !state.jarBuilt) return err('Not a valid JAR: ' + jarName);
  if (mainClass !== 'WeatherDataProcessor') return err('java.lang.ClassNotFoundException: ' + mainClass);
  var inSegs = hdfsSegs(inPath);
  if (!getNode(state.hdfs, inSegs)) {
    return err('org.apache.hadoop.mapreduce.lib.input.InvalidInputException: Input path does not exist: hdfs://localhost:9000' + hdfsPathStr(inSegs));
  }
  var outSegs = hdfsSegs(outPath);
  if (getNode(state.hdfs, outSegs)) {
    return err('org.apache.hadoop.mapred.FileAlreadyExistsException: Output directory hdfs://localhost:9000' + hdfsPathStr(outSegs) + ' already exists\n' +
      '(hint: delete it first —  hdfs dfs -rm -r ' + hdfsPathStr(outSegs) + ')');
  }
  var parent = state.hdfs;
  for (var i = 0; i < outSegs.length - 1; i++) {
    if (!parent.children[outSegs[i]]) parent.children[outSegs[i]] = dir();
    parent = parent.children[outSegs[i]];
  }
  parent.children[outSegs[outSegs.length - 1]] = dir({
    '_SUCCESS': file(''),
    'part-r-00000': file(WEATHER_PART)
  });
  state.jobRuns += 1;
  var jobId = 'job_1784959837525_000' + state.jobRuns;
  return ok([
    'INFO client.DefaultNoHARMFailoverProxyProvider: Connecting to ResourceManager at /0.0.0.0:8032',
    'INFO mapreduce.JobSubmitter: number of splits:1',
    'INFO mapreduce.Job: Running job: ' + jobId,
    'INFO mapreduce.Job:  map 0% reduce 0%',
    'INFO mapreduce.Job:  map 100% reduce 0%',
    'INFO mapreduce.Job:  map 100% reduce 100%',
    'INFO mapreduce.Job: Job ' + jobId + ' completed successfully',
    '\tMap input records=31',
    '\tMap output records=31',
    '\tReduce output records=31'
  ].join('\n'));
}

// ---------- preflight + Pig ----------

var PIG_RESULTS = [
  '(Alice,B)',
  '(David,B)',
  '(Math,{(4,Math,88),(2,Math,78),(1,Math,85)})',
  '(Science,{(3,Science,90)})',
  '(1,John,18,A,1,Math,85)',
  '(2,Alice,19,B,2,Math,78)',
  '(3,Bob,17,A,3,Science,90)',
  '(4,David,20,B,4,Math,88)'
].join('\n');

function javaVersion(state) {
  if (state.os === 'windows') {
    return ok('java version "1.8.0_202"\nJava(TM) SE Runtime Environment (build 1.8.0_202-b08)\nJava HotSpot(TM) 64-Bit Server VM (build 25.202-b08, mixed mode)');
  }
  return ok('openjdk version "11.0.27" 2025-04-15\nOpenJDK Runtime Environment (build 11.0.27+6)\nOpenJDK 64-Bit Server VM (build 11.0.27+6, mixed mode)');
}

function echoCmd(state, args) {
  var joined = args.join(' ');
  if (state.os === 'windows') {
    if (/%HADOOP_HOME%/.test(joined)) return ok(joined.replace(/%HADOOP_HOME%/g, 'C:\\hadoop'));
    return ok(joined);
  }
  if (/\$HADOOP_HOME/.test(joined)) return ok(joined.replace(/\$HADOOP_HOME/g, '/home/student/bigdata/hadoop-3.4.1'));
  if (/\$PIG_HOME/.test(joined)) return ok(joined.replace(/\$PIG_HOME/g, '/home/student/bigdata/pig-0.17.0'));
  return ok(joined);
}

function pigCmd(state, args) {
  if (args[0] === '-version' || args[0] === '--version') {
    return ok('Apache Pig version 0.17.0 (r1797386) \ncompiled Jun 02 2017, 15:41:58');
  }
  if (args[0] === '-x' && args[1] === 'local') {
    var scriptName = args[2];
    if (!scriptName) {
      return err('(the interactive grunt> shell is not simulated here — give it the script file: pig -x local script.pig)');
    }
    var node = getNode(state.local, localSegs(state, scriptName));
    if (!node || node.type !== 'file') {
      return err('ERROR 2997: Encountered IOException. File ' + scriptName + ' does not exist\n(hint: cd into the folder that holds script.pig first — the LOAD paths are relative)');
    }
    var cwdNode = getNode(state.local, state.cwd);
    if (!cwdNode.children['students.csv'] || !cwdNode.children['scores.csv']) {
      return err("ERROR 2118: Input path does not exist: file://" + '.../students.csv' + '\n(hint: the script LOADs students.csv and scores.csv from the CURRENT folder)');
    }
    return ok([
      'INFO  org.apache.pig.Main - Apache Pig version 0.17.0 (r1797386)',
      'INFO  org.apache.pig.backend.hadoop.executionengine.HExecutionEngine - Connecting to hadoop file system at: file:///',
      'INFO  org.apache.pig.backend.hadoop.executionengine.mapReduceLayer.MapReduceLauncher - 100% complete',
      'INFO  org.apache.pig.backend.hadoop.executionengine.mapReduceLayer.MapReduceLauncher - Success!',
      PIG_RESULTS
    ].join('\n'));
  }
  if (args[0] === '-x') return err('ERROR: Unrecognized exec type: ' + (args[1] || '') + ' (use: pig -x local script.pig)');
  return err('(this simulator knows: pig -version  and  pig -x local script.pig)');
}

function localCat(state, args) {
  var paths = args.filter(function (a) { return a.indexOf('-') !== 0; });
  if (!paths.length) return err('cat: missing operand');
  var out = [];
  for (var i = 0; i < paths.length; i++) {
    var node = getNode(state.local, localSegs(state, paths[i]));
    if (!node) return err('cat: ' + paths[i] + ': No such file or directory');
    if (node.type === 'dir') return err('cat: ' + paths[i] + ': Is a directory');
    out.push(node.content);
  }
  return ok(out.join('\n'));
}

// ---------- dispatch ----------

function notFound(state, cmd) {
  var msg = isUnix(state)
    ? 'zsh: command not found: ' + cmd
    : "'" + cmd + "' is not recognized as an internal or external command";
  return err(msg);
}

function runCommand(state, input) {
  var tokens = tokenize(String(input || '').trim());
  if (!tokens.length) return ok('');
  var cmd = tokens[0];

  // cluster lifecycle (per OS)
  if (cmd === 'hadoop-start' || cmd === 'hadoop-stop') {
    if (!isUnix(state)) {
      var r = notFound(state, cmd);
      r.output += '\n(on native Windows the cluster starts with: start-all.cmd / stops with: stop-all.cmd)';
      return r;
    }
    return cmd === 'hadoop-start' ? startCluster(state) : stopCluster(state);
  }
  if (cmd === 'start-all.cmd' || cmd === 'stop-all.cmd') {
    if (isUnix(state)) {
      var r2 = notFound(state, cmd);
      r2.output += '\n(on Linux/Mac this cluster starts with: hadoop-start / stops with: hadoop-stop)';
      return r2;
    }
    return cmd === 'start-all.cmd' ? startCluster(state) : stopCluster(state);
  }

  if (cmd === 'jps') return jps(state);

  if (cmd === 'hadoop' || cmd === 'hdfs') {
    var sub = tokens[1];
    if ((cmd === 'hadoop' && sub === 'fs') || (cmd === 'hdfs' && sub === 'dfs')) {
      return fsCmd(state, tokens.slice(2), cmd === 'hadoop' ? 'hadoop fs' : 'hdfs dfs');
    }
    if (cmd === 'hadoop' && sub === 'classpath') return ok(CLASSPATH);
    if (cmd === 'hadoop' && sub === 'jar') return hadoopJar(state, tokens.slice(2));
    if (cmd === 'hadoop' && sub === 'version') {
      var ver = state.os === 'windows' ? '3.3.6' : '3.4.1';
      return ok('Hadoop ' + ver + '\nSource code repository https://github.com/apache/hadoop.git\nCompiled with protoc\nThis command was run using /opt/hadoop/share/hadoop/common/hadoop-common-' + ver + '.jar');
    }
    if (cmd === 'hdfs' && sub === 'dfsadmin') {
      if (tokens[2] !== '-report') return err('dfsadmin: unknown option ' + (tokens[2] || '') + ' (try: hdfs dfsadmin -report)');
      if (!state.clusterUp) return connRefused('report');
      var used = 4096 + JSON.stringify(state.hdfs).length;
      return ok([
        'Configured Capacity: 250790436864 (233.57 GB)',
        'Present Capacity: 198654312448 (185.01 GB)',
        'DFS Remaining: 198654308352 (185.01 GB)',
        'DFS Used: ' + used + ' (' + (used / 1024).toFixed(1) + ' KB)',
        'DFS Used%: 0.00%',
        'Live datanodes (1):',
        '',
        'Name: 127.0.0.1:9866 (localhost)',
        'Hostname: localhost',
        'Decommission Status : Normal',
        'DFS Used: ' + used,
        'Last contact: just now'
      ].join('\n'));
    }
    return err(cmd + ' ' + (sub || '') + ': unknown subcommand (try: ' + (cmd === 'hadoop' ? 'hadoop fs -…' : 'hdfs dfs -…') + ')');
  }

  if (cmd === 'javac') return javac(state, tokens.slice(1));
  if (cmd === 'jar') return jarTool(state, tokens.slice(1));

  if (cmd === 'java' && tokens[1] === '-version') return javaVersion(state);
  if (cmd === 'java') return err('Usage: java -version   (running programs by hand is not part of the lab — hadoop jar does that)');
  if (cmd === 'pig') return pigCmd(state, tokens.slice(1));
  if (cmd === 'echo') return echoCmd(state, tokens.slice(1));

  if (cmd === 'ls' || cmd === 'dir') return localLs(state);
  if (cmd === 'cd') return localCd(state, tokens[1]);
  if (cmd === 'pwd') return ok(cwdString(state));
  if (cmd === 'mkdir') return localMkdir(state, tokens.slice(1));
  if (cmd === 'cat' || cmd === 'type') return localCat(state, tokens.slice(1));

  return notFound(state, cmd);
}

var api = { createState: createState, runCommand: runCommand, WARN: WARN, cwdString: cwdString };
root.BDALEngine = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
