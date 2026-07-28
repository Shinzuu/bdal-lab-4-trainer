/* BDAL Lab 4 Trainer — lesson data. Pure data + generators; engine passed in where needed.
 * Step: { theory?, question, hints:[h1,h2], answer(os), check(state,result,input), note? } */
(function (root) {
'use strict';

// ---------- helpers ----------

function hnode(state, path) {
  var segs = path.split('/').filter(Boolean);
  var node = state.hdfs;
  for (var i = 0; i < segs.length; i++) {
    if (!node || node.type !== 'dir') return null;
    node = node.children[segs[i]];
  }
  return node || null;
}

function lnode(state, segs) {
  var node = state.local;
  for (var i = 0; i < segs.length; i++) {
    if (!node || node.type !== 'dir') return null;
    node = node.children[segs[i]];
  }
  return node || null;
}

function cwdHas(state, name) {
  var node = lnode(state, state.cwd.concat([name]));
  return !!node;
}

function isWin(os) { return os === 'windows'; }

// canonical per-OS fragments
function startCmd(os) { return isWin(os) ? 'start-all.cmd' : 'hadoop-start'; }
function kitCd(os) { return isWin(os) ? 'cd C:/BDA' : 'cd ~/kit/Lab-2-HDFS-Basic-Commands'; }
function weatherCd(os) { return isWin(os) ? 'cd C:/BDA' : 'cd ~/weather'; }
function pigCd(os) { return isWin(os) ? 'cd C:/piglab' : 'cd ~/piglab'; }
function localRef(os, name) { return isWin(os) ? 'C:/BDA/' + name : name; }
function catCmd(os, name) { return isWin(os) ? 'type ' + name : 'cat ' + name; }
function echoHome(os) { return isWin(os) ? 'echo %HADOOP_HOME%' : 'echo $HADOOP_HOME'; }
function javacCmd(os) {
  return isWin(os)
    ? 'javac -classpath "%HADOOP_HOME%\\share\\hadoop\\common\\*;%HADOOP_HOME%\\share\\hadoop\\mapreduce\\*" -d . WeatherDataProcessor.java'
    : 'javac -classpath "$(hadoop classpath)" -d . WeatherDataProcessor.java';
}
function jarCmd(os) {
  return isWin(os) ? 'jar -cvf WeatherDataProcessor.jar -C . .' : 'jar -cf WeatherDataProcessor.jar *.class';
}

// ---------- generic step builders ----------

function stepStart() {
  return {
    theory: 'A Hadoop cluster is a team of daemon (background) processes — NameNode, DataNode, ResourceManager, NodeManager… They never start by themselves: every lab session begins by starting them.',
    question: 'Start your Hadoop cluster.',
    hints: ['One short command starts everything. On Linux/Mac it is a hyphenated word; on Windows it is a .cmd script.',
      'It begins with “start” on Windows, and with “hadoop-” on Linux/Mac.'],
    answer: startCmd,
    anatomy: function (os) {
      return [[startCmd(os), 'one script that starts every daemon at once (its twin, ' + (os === 'windows' ? 'stop-all.cmd' : 'hadoop-stop') + ', stops them)']];
    },
    check: function (state) { return state.clusterUp; }
  };
}

function stepJps() {
  return {
    theory: 'jps lists the running Java processes — it is THE health check. Expect 5 daemons on Linux/Mac, 4 on native Windows (no SecondaryNameNode there). If a daemon is missing, nothing else will work.',
    question: 'Verify the cluster daemons are actually running.',
    hints: ['It is a 3-letter command: Java Process Status.', 'Just type the three letters.'],
    answer: function () { return 'jps'; },
    anatomy: function () { return [['jps', 'Java Process Status — lists every running Java daemon with its process id']]; },
    check: function (state, result, input) { return result.ok && /^jps$/.test(input.trim()); }
  };
}

function stepLsRoot(expectText) {
  return {
    theory: 'HDFS is a SEPARATE filesystem living inside those daemons — your normal files are not in it. You reach it with `hadoop fs -…` (or `hdfs dfs -…`, identical). Web view: http://localhost:9870 → Utilities. Jobs: http://localhost:8088.',
    question: 'List the ROOT directory of HDFS.',
    hints: ['hadoop fs -ls needs a path; the HDFS root is “/”.', 'Shape: hadoop fs -ls <path>  — the root path is a single slash.'],
    answer: function () { return 'hadoop fs -ls /'; },
    anatomy: function () {
      return [['hadoop fs', 'talk to HDFS (not your normal disk)'],
        ['-ls', 'list a directory'],
        ['/', 'which one — a single slash is the HDFS root']];
    },
    check: function (state, result, input) {
      return result.ok && /-ls\s+\/\s*$/.test(input) && (!expectText || result.output.indexOf(expectText) !== -1);
    }
  };
}

function stepMkdir(path, theory) {
  return {
    theory: theory,
    question: 'Create the directory ' + path + ' in HDFS.',
    hints: ['The fs subcommand is -mkdir, and HDFS paths start at “/”.', 'Shape: hadoop fs -mkdir ' + path],
    answer: function () { return 'hadoop fs -mkdir ' + path; },
    anatomy: function () {
      return [['hadoop fs', 'talk to HDFS'],
        ['-mkdir', 'make a directory'],
        [path, 'where to make it (leading / = from the HDFS root)']];
    },
    check: function (state) { var n = hnode(state, path); return !!n && n.type === 'dir'; }
  };
}

function stepLs(path, mustContain) {
  return {
    question: 'List ' + path + ' to confirm.',
    hints: ['Same -ls as before, different path.', 'Shape: hadoop fs -ls ' + path],
    answer: function () { return 'hadoop fs -ls ' + path; },
    anatomy: function () {
      return [['hadoop fs', 'talk to HDFS'], ['-ls', 'list a directory'], [path, 'the directory to look inside']];
    },
    check: function (state, result, input) {
      return result.ok && input.indexOf('-ls') !== -1 && result.output.indexOf(mustContain) !== -1;
    }
  };
}

function stepCd(cdCmd, theory) {
  return {
    theory: theory,
    question: 'Move into the folder that holds the sample files.',
    hints: ['Plain shell cd — no hadoop involved.', 'Shape: ' + cdCmd('linux') + '   (Windows: ' + cdCmd('windows') + ')'],
    answer: cdCmd,
    anatomy: function (os) {
      return [['cd', 'change directory — plain shell, no hadoop'],
        [cdCmd(os).slice(3), 'the local folder holding the sample files']];
    },
    check: function (state, result, input) {
      if (!result.ok || !/^cd\s/.test(input.trim())) return false;
      var last = state.cwd[state.cwd.length - 1];
      return last === 'Lab-2-HDFS-Basic-Commands' || last === 'BDA';
    }
  };
}

function stepPut(fileName, hdfsDir, opts) {
  opts = opts || {};
  var verb = opts.useAlias ? '-put' : '-copyFromLocal';
  return {
    theory: opts.theory,
    note: opts.note,
    question: 'Copy the LOCAL file ' + fileName + ' into HDFS directory ' + hdfsDir + (opts.useAlias ? ' (use the short alias this time).' : '.'),
    hints: ['Local → HDFS is -copyFromLocal (or its alias -put). Arguments: local source first, HDFS destination second.',
      'Shape: hadoop fs ' + verb + ' ' + fileName + ' ' + hdfsDir + '   (Windows: give the full C:/… path to the file)'],
    answer: function (os) { return 'hadoop fs ' + verb + ' ' + localRef(os, fileName) + ' ' + hdfsDir; },
    anatomy: function (os) {
      return [['hadoop fs', 'talk to HDFS'],
        [verb, 'copy local \u2192 HDFS' + (opts.useAlias ? ' (alias of -copyFromLocal)' : ' (alias: -put)')],
        [localRef(os, fileName), 'SOURCE: the file on your disk'],
        [hdfsDir, 'DESTINATION: a directory in HDFS']];
    },
    check: function (state) { var n = hnode(state, hdfsDir + '/' + fileName); return !!n && n.type === 'file'; }
  };
}

function stepLocalMkdir(dirName) {
  return {
    theory: 'Downloads out of HDFS need a landing folder on your normal disk — make one.',
    question: 'Create a LOCAL folder called ' + dirName + ' (in your current directory).',
    hints: ['Plain shell mkdir, not hadoop fs.', 'Shape: mkdir -p ' + dirName],
    answer: function (os) { return isWin(os) ? 'mkdir ' + dirName : 'mkdir -p ' + dirName; },
    anatomy: function (os) {
      var rows = [['mkdir', 'make a LOCAL folder (your disk, not HDFS)']];
      if (!isWin(os)) rows.push(['-p', 'no complaint if it already exists']);
      rows.push([dirName, 'the folder name']);
      return rows;
    },
    check: function (state) { return cwdHas(state, dirName); }
  };
}

function stepGet(hdfsPath, localDir, opts) {
  opts = opts || {};
  var verb = opts.useAlias ? '-get' : '-copyToLocal';
  var fname = hdfsPath.split('/').pop();
  return {
    theory: opts.theory,
    note: opts.note,
    question: 'Copy ' + hdfsPath + ' OUT of HDFS into your local ' + localDir + ' folder' + (opts.useAlias ? ' (short alias).' : '.'),
    hints: ['HDFS → local is -copyToLocal (or its alias -get). HDFS source first, local destination second — the mirror image of put.',
      'Shape: hadoop fs ' + verb + ' ' + hdfsPath + ' ' + localDir + '/'],
    answer: function () { return 'hadoop fs ' + verb + ' ' + hdfsPath + ' ' + localDir + '/'; },
    anatomy: function () {
      return [['hadoop fs', 'talk to HDFS'],
        [verb, 'copy HDFS \u2192 local' + (opts.useAlias ? ' (alias of -copyToLocal)' : ' (alias: -get)')],
        [hdfsPath, 'SOURCE: the file in HDFS'],
        [localDir + '/', 'DESTINATION: your local folder']];
    },
    check: function (state) {
      return cwdHas(state, localDir) && !!lnode(state, state.cwd.concat([localDir, fname]));
    }
  };
}

function stepCat(hdfsPath, contentFragment) {
  return {
    theory: '-cat prints a file’s contents straight from HDFS — the quickest way to check what is inside.',
    question: 'Show the contents of ' + hdfsPath + '.',
    hints: ['Same idea as Unix cat, but as an fs subcommand.', 'Shape: hadoop fs -cat ' + hdfsPath],
    answer: function () { return 'hadoop fs -cat ' + hdfsPath; },
    anatomy: function () {
      return [['hadoop fs', 'talk to HDFS'], ['-cat', 'print a file\u2019s contents'], [hdfsPath, 'the file to read']];
    },
    check: function (state, result, input) {
      return result.ok && input.indexOf('-cat') !== -1 && result.output.indexOf(contentFragment) !== -1;
    }
  };
}

function stepRmFile(hdfsPath, theory) {
  return {
    theory: theory,
    question: 'Delete the FILE ' + hdfsPath + ' from HDFS.',
    hints: ['-rm deletes files (it refuses directories without -r).', 'Shape: hadoop fs -rm ' + hdfsPath],
    answer: function () { return 'hadoop fs -rm ' + hdfsPath; },
    anatomy: function () {
      return [['hadoop fs', 'talk to HDFS'], ['-rm', 'delete a FILE (refuses directories)'], [hdfsPath, 'the file to delete']];
    },
    check: function (state, result, input) { return result.ok && input.indexOf('-rm') !== -1 && !hnode(state, hdfsPath); }
  };
}

function stepRmdir(hdfsPath) {
  return {
    theory: '-rmdir removes a directory ONLY if it is empty — it is the safe delete. (You just emptied this one.)',
    question: 'Remove the now-empty directory ' + hdfsPath + '.',
    hints: ['Not -rm this time — the empty-only variant.', 'Shape: hadoop fs -rmdir ' + hdfsPath],
    answer: function () { return 'hadoop fs -rmdir ' + hdfsPath; },
    anatomy: function () {
      return [['hadoop fs', 'talk to HDFS'], ['-rmdir', 'delete a directory ONLY if empty'], [hdfsPath, 'the empty directory']];
    },
    check: function (state, result, input) { return result.ok && input.indexOf('-rmdir') !== -1 && !hnode(state, hdfsPath); }
  };
}

function stepRmR(hdfsPath, theory) {
  return {
    theory: theory,
    question: 'Delete ' + hdfsPath + ' and EVERYTHING inside it, in one command.',
    hints: ['-rm plus the recursive flag.', 'Shape: hadoop fs -rm -r ' + hdfsPath],
    answer: function () { return 'hadoop fs -rm -r ' + hdfsPath; },
    anatomy: function () {
      return [['hadoop fs', 'talk to HDFS'], ['-rm', 'delete'], ['-r', 'recursive: the directory AND everything inside'], [hdfsPath, 'what to wipe']];
    },
    check: function (state, result, input) { return result.ok && /-rm\s+-r/.test(input) && !hnode(state, hdfsPath); }
  };
}

// ---------- preflight steps ----------

function stepJavaVersion() {
  return {
    theory: 'PREREQUISITES for the labs: a JDK (Java 11 on Linux/Mac, Java 8 on native Windows), Hadoop extracted with HADOOP_HOME + PATH set, and Apache Pig 0.17.0 the same way. Before ANY lab, prove each one answers. First: Java.',
    question: 'Check which Java version is installed.',
    hints: ['The java launcher has a -version flag.', 'Shape: java -version   (note: ONE dash)'],
    answer: function () { return 'java -version'; },
    anatomy: function () {
      return [['java', 'the Java launcher — Hadoop and Pig both run on it'],
        ['-version', 'print the installed version (one dash, unlike most tools)']];
    },
    check: function (state, result, input) { return result.ok && /^java\s+-+version$/.test(input.trim()); }
  };
}

function stepHadoopVersion() {
  return {
    theory: 'Know your Hadoop version: 3.x uses web UI port 9870 — old manuals say 50070, which is 2.x. Version mismatches are the #1 source of “why doesn’t my machine match the manual”.',
    question: 'Print which Hadoop version you are running.',
    hints: ['Plain hadoop subcommand, no dash.', 'Shape: hadoop version'],
    answer: function () { return 'hadoop version'; },
    anatomy: function () {
      return [['hadoop', 'the hadoop launcher'], ['version', 'print the installed version (no dash!)']];
    },
    check: function (state, result, input) { return result.ok && /^hadoop\s+version$/.test(input.trim()); }
  };
}

function stepEchoHome() {
  return {
    theory: 'Hadoop’s scripts find their install through the HADOOP_HOME environment variable. If it is empty, every hadoop command dies with “command not found” — check it before blaming anything else.',
    question: 'Print the value of the HADOOP_HOME environment variable.',
    hints: ['echo the variable. Linux/Mac: $NAME · Windows: %NAME%.', 'Shape: ' + echoHome('linux') + '   (Windows: ' + echoHome('windows') + ')'],
    answer: echoHome,
    anatomy: function (os) {
      return [['echo', 'print whatever follows'],
        [isWin(os) ? '%HADOOP_HOME%' : '$HADOOP_HOME', 'the variable that points at the Hadoop install folder']];
    },
    check: function (state, result, input) {
      return result.ok && /echo/.test(input) && /HADOOP_HOME/.test(input) && /hadoop/i.test(result.output);
    }
  };
}

function stepPigVersion(opts) {
  opts = opts || {};
  return {
    theory: opts.theory,
    question: 'Prove Pig is installed: print its version.',
    hints: ['Same pattern as java: the launcher plus -version.', 'Shape: pig -version'],
    answer: function () { return 'pig -version'; },
    anatomy: function () {
      return [['pig', 'the Pig launcher (works once PIG_HOME/bin is on PATH)'],
        ['-version', 'print the installed version — the lab asks for this as PROOF of install']];
    },
    check: function (state, result, input) {
      return result.ok && /^pig\s+-+version$/.test(input.trim()) && result.output.indexOf('0.17.0') !== -1;
    }
  };
}

// ---------- weather (Lab 4) steps ----------

function stepWeatherCd() {
  return {
    theory: 'Weather.csv and WeatherDataProcessor.java sit on your LOCAL disk — go to them first, so every later command can use bare filenames.',
    question: 'Move into the folder holding Weather.csv and WeatherDataProcessor.java.',
    hints: ['Plain cd.', 'Shape: cd ~/weather   (Windows: cd C:/BDA)'],
    answer: weatherCd,
    anatomy: function (os) {
      return [['cd', 'change directory — plain shell'],
        [weatherCd(os).slice(3), 'the local folder with the weather lab files']];
    },
    check: function (state, result, input) {
      if (!result.ok || !/^cd\s/.test(input.trim())) return false;
      var last = state.cwd[state.cwd.length - 1];
      return last === 'weather' || last === 'BDA';
    }
  };
}

function stepCatLocal(fileName, fragment, theory, note) {
  return {
    theory: theory,
    note: note,
    question: 'Look inside the LOCAL file ' + fileName + ' before doing anything with it.',
    hints: ['Plain shell — cat on Linux/Mac, type on Windows. No hadoop.', 'Shape: cat ' + fileName + '   (Windows: type ' + fileName + ')'],
    answer: function (os) { return catCmd(os, fileName); },
    anatomy: function (os) {
      return [[isWin(os) ? 'type' : 'cat', 'print a LOCAL file (your disk — no hadoop involved)'],
        [fileName, 'the file to inspect — never feed a job a file you haven\u2019t looked at']];
    },
    check: function (state, result, input) {
      return result.ok && result.output.indexOf(fragment) !== -1 && input.indexOf('hadoop') === -1;
    }
  };
}

function stepJavacW() {
  return {
    theory: 'The weather program is YOUR Java code — Hadoop has no built-in jar for it. Compile it against Hadoop’s libraries by passing Hadoop’s classpath to javac. (The mapper classifies each day: snow → storm → rain → hot ≥30 → cold <10 → moderate, in that priority order.)',
    question: 'Compile WeatherDataProcessor.java against the Hadoop classpath.',
    hints: ['javac needs -classpath <hadoop’s jars> and the .java file. On Linux/Mac splice the classpath in with "$(hadoop classpath)".',
      'Shape: javac -classpath "$(hadoop classpath)" -d . WeatherDataProcessor.java'],
    answer: javacCmd,
    anatomy: function (os) {
      return [['javac', 'the Java compiler'],
        [os === 'windows' ? '-classpath "%HADOOP_HOME%\\...\\*"' : '-classpath "$(hadoop classpath)"', 'let it see Hadoop\u2019s libraries while compiling'],
        ['-d .', 'drop the .class files right here'],
        ['WeatherDataProcessor.java', 'your source file']];
    },
    check: function (state) { return state.compiled; }
  };
}

function stepJarW() {
  return {
    theory: 'MapReduce wants ONE .jar file, not loose .class files — package the three classes you just compiled (main + $WeatherMapper + $WeatherReducer).',
    question: 'Package the compiled classes into WeatherDataProcessor.jar.',
    hints: ['The jar tool with -cf <name.jar> <what to include>.', 'Shape: jar -cf WeatherDataProcessor.jar *.class'],
    answer: jarCmd,
    anatomy: function (os) {
      return [['jar', 'the packager'],
        [os === 'windows' ? '-cvf' : '-cf', 'Create a File (v = list what goes in)'],
        ['WeatherDataProcessor.jar', 'the output jar name'],
        [os === 'windows' ? '-C . .' : '*.class', 'what to pack: the compiled classes']];
    },
    check: function (state) { return state.jarBuilt; }
  };
}

function stepRunJobW(inPath, outPath) {
  return {
    theory: 'hadoop jar <jar> <MainClass> <input> <output> submits the job to YARN. The output directory must NOT exist yet — MapReduce refuses to overwrite. Expect the counters to say 31 records in AND 31 out: every date is unique, so the reducer just passes each one through (an “identity” reducer).',
    question: 'Run the job: input ' + inPath + ', output ' + outPath + '.',
    hints: ['hadoop jar, then the jar file, then the main class name (WeatherDataProcessor), then input path, then output path.',
      'Shape: hadoop jar WeatherDataProcessor.jar WeatherDataProcessor ' + inPath + ' ' + outPath],
    answer: function () { return 'hadoop jar WeatherDataProcessor.jar WeatherDataProcessor ' + inPath + ' ' + outPath; },
    anatomy: function () {
      return [['hadoop jar', 'run a MapReduce program from a jar'],
        ['WeatherDataProcessor.jar', 'which jar'],
        ['WeatherDataProcessor', 'the main class inside it'],
        [inPath, 'input: your data in HDFS'],
        [outPath, 'output dir \u2014 must NOT exist yet']];
    },
    check: function (state) { return !!hnode(state, outPath + '/part-r-00000'); }
  };
}

function stepReadResultW(outPath) {
  return {
    theory: 'Reducers write part-r-00000 (+ a _SUCCESS marker). The output is date-sorted — the shuffle sorts keys. Traps to spot: “Drizzle” days come out Moderate (the code checks contains("rain") — drizzle doesn’t contain it), “Thunderstorm” is Stormy (contains "storm"), and there is NO Cold Day — every sub-10° day is also Snow/Rain, which win first.',
    note: 'In the REAL lab the task also says: change the six weatherMessage.set("…") strings to YOUR OWN messages before compiling — everyone’s output text must differ. Only the strings change; the classification pattern stays exactly this.',
    question: 'Read the job result from ' + outPath + '.',
    hints: ['It is just -cat on the part file.', 'Shape: hadoop fs -cat ' + outPath + '/part-r-00000'],
    answer: function () { return 'hadoop fs -cat ' + outPath + '/part-r-00000'; },
    anatomy: function () {
      return [['hadoop fs -cat', 'print a file from HDFS'],
        [outPath + '/part-r-00000', 'the reducer\u2019s output file (r = reducer, 00000 = first one)']];
    },
    check: function (state, result, input) {
      return result.ok && input.indexOf('-cat') !== -1 && result.output.indexOf('Stormy') !== -1 && result.output.indexOf('Hot Day') !== -1;
    }
  };
}

// ---------- Pig steps ----------

function stepPigCd() {
  return {
    theory: 'The Pig lab runs in LOCAL mode (-x local): no cluster needed, files read straight from your disk. The script LOADs students.csv and scores.csv with RELATIVE paths — so you must be standing in their folder.',
    question: 'Move into the folder holding the Pig lab files.',
    hints: ['Plain cd.', 'Shape: cd ~/piglab   (Windows: cd C:/piglab)'],
    answer: pigCd,
    anatomy: function (os) {
      return [['cd', 'change directory'],
        [pigCd(os).slice(3), 'the folder with students.csv, scores.csv and script.pig']];
    },
    check: function (state, result, input) {
      if (!result.ok || !/^cd\s/.test(input.trim())) return false;
      return state.cwd[state.cwd.length - 1] === 'piglab';
    }
  };
}

function stepPigLs() {
  return {
    theory: 'Never run a script blind — first confirm all three files are actually here.',
    question: 'List the files in this folder.',
    hints: ['Plain local listing — ls (Windows also accepts dir).', 'Shape: ls'],
    answer: function (os) { return isWin(os) ? 'dir' : 'ls'; },
    anatomy: function (os) { return [[isWin(os) ? 'dir' : 'ls', 'list the LOCAL folder — expect students.csv, scores.csv, script.pig']]; },
    check: function (state, result, input) {
      return result.ok && /^(ls|dir)\b/.test(input.trim()) && result.output.indexOf('script.pig') !== -1;
    }
  };
}

function stepPigRun() {
  return {
    theory: 'pig -x local script.pig runs the whole script through Pig’s local engine. The script does all five required operations: FILTER (age > 18) → FOREACH/GENERATE (project name, grade) → ORDER (sort by name) → GROUP (scores by subject) → JOIN (students ⋈ scores on student_id), then DUMPs each result.',
    question: 'Run the Pig script in local mode.',
    hints: ['pig, the execution-mode flag with “local”, then the script file.', 'Shape: pig -x local script.pig'],
    answer: function () { return 'pig -x local script.pig'; },
    anatomy: function () {
      return [['pig', 'the Pig launcher'],
        ['-x local', 'eXecution mode: local disk, no Hadoop cluster involved'],
        ['script.pig', 'the Pig Latin script to run']];
    },
    check: function (state, result, input) {
      return result.ok && /pig\s+-x\s+local\s+script\.pig/.test(input) && result.output.indexOf('(Alice,B)') !== -1;
    }
  };
}

// ---------- modules ----------

var MODULES = [
  {
    id: 'm1',
    title: 'Preflight — prove the install',
    subtitle: 'java · hadoop version · HADOOP_HOME · pig -version',
    intro: 'Before ANY lab: a JDK must be installed (Java 11 on Linux/Mac, Java 8 on native Windows), Hadoop extracted with HADOOP_HOME + PATH set, and Apache Pig 0.17.0 extracted with PIG_HOME + PATH set. This module is the 60-second check that each one actually answers — run it at the start of every lab session.',
    outcome: 'All four checks answer: `java -version` prints a JDK, `hadoop version` prints 3.x, HADOOP_HOME echoes a real folder, and `pig -version` prints 0.17.0. If any of them fails, fix it NOW — nothing later works without it.',
    troubleshooting: [
      ['command not found: hadoop', 'HADOOP_HOME/PATH not set in this shell. Linux/Mac: `source ~/bigdata/hadoop-env.sh` (or open a new terminal). Windows: re-check Environment Variables and open a NEW cmd window — old windows keep the old variables.'],
      ['command not found: pig', 'PIG_HOME/bin is not on PATH. Set `export PIG_HOME=<pig folder>` and add `$PIG_HOME/bin` to PATH, then open a new terminal.'],
      ['echo prints an empty line', 'The variable is not set in this shell — same fix as above: source the env file / new terminal.'],
      ['java points at the wrong version', 'JAVA_HOME wins over PATH for Hadoop. Point JAVA_HOME at the JDK folder itself (the one containing bin/), not at bin/java.']
    ],
    setup: function (engine, os) { return engine.createState(os); },
    steps: [
      stepJavaVersion(),
      stepHadoopVersion(),
      stepEchoHome(),
      stepPigVersion({ theory: 'Pig setup = download pig-0.17.0.tar.gz → extract → export PIG_HOME=<folder> and add $PIG_HOME/bin to PATH. Then this one command is the proof the lab sheet asks for.' })
    ]
  },
  {
    id: 'm2',
    title: 'Boot the cluster',
    subtitle: 'start · jps · first look at HDFS',
    intro: 'Needs: module 1 passing (Hadoop answers). The cluster daemons do not survive a reboot — every session starts with starting them, then PROVING they run with jps, then one look into HDFS.',
    outcome: 'jps lists 5 daemons on Linux/Mac (NameNode, DataNode, SecondaryNameNode, ResourceManager, NodeManager) or 4 on native Windows, and `hadoop fs -ls /` answers without errors. Web check: http://localhost:9870 loads.',
    troubleshooting: [
      ['Connection refused localhost:9000', 'The cluster is not running (or NameNode died). Run the start command, wait ~10 s, jps again.'],
      ['jps is missing the DataNode', 'Usually a clusterID mismatch after re-formatting the NameNode. Stop all, delete the datanode data directory, `hdfs namenode -format`, start again.'],
      ['jps is missing the NameNode', 'Almost always a formatting problem — check the namenode log; on first install run `hdfs namenode -format` once.'],
      ['Windows: a daemon console window closed', 'On native Windows each daemon lives in its own console window — closing the window kills that daemon. Re-run start-all.cmd and leave all windows open.']
    ],
    setup: function (engine, os) { return engine.createState(os); },
    steps: [
      stepStart(),
      stepJps(),
      stepLsRoot('Found 2 items')
    ]
  },
  {
    id: 'm3',
    title: 'HDFS commands — Lab 2',
    subtitle: 'mkdir · put/get · cat · rm — the full lab sheet',
    intro: 'Needs: cluster running (module 2). This is the full Lab-2 sheet: create HDFS directories, move files IN (copyFromLocal/put), OUT (copyToLocal/get), read them (cat), delete them (rm / rmdir / rm -r). Remember: `hadoop fs` and `hdfs dfs` are the SAME command.',
    outcome: 'You round-tripped files into and out of HDFS and cleaned everything up — `hadoop fs -ls /` shows just /tmp and /user again, exactly as you found it.',
    troubleshooting: [
      ['put: `…\': File exists', 'The file is already there. Add -f to overwrite (`-put -f`), or delete the old one first.'],
      ['put: `…\': No such file or directory (the LOCAL file)', 'You are not in the folder that holds the file — cd there first, or give the full path. Paths with SPACES must be quoted (better: avoid them).'],
      ['rmdir: Directory is not empty', '-rmdir only deletes EMPTY directories. Delete the contents first, or use `-rm -r` for directory + contents in one go.'],
      ['rm: `…\': Is a directory', 'Plain -rm refuses directories — add -r.'],
      ['WARN util.NativeCodeLoader', 'Harmless on every machine in this course. Ignore it, always.']
    ],
    setup: function (engine, os) {
      var s = engine.createState(os);
      engine.runCommand(s, os === 'windows' ? 'start-all.cmd' : 'hadoop-start');
      return s;
    },
    steps: [
      stepMkdir('/dir1', '-mkdir creates a directory in HDFS — on the cluster, not on your disk.'),
      stepLs('/', '/dir1'),
      stepMkdir('/dir1/newdir', 'Paths nest exactly like a normal filesystem — a directory inside a directory.'),
      stepCd(kitCd, 'The sample files live on your LOCAL disk. Local paths with SPACES break Hadoop commands — so we cd into the folder and use bare filenames.'),
      stepPut('command3.txt', '/dir1', { theory: 'Local → HDFS is -copyFromLocal: local source first, HDFS destination second.' }),
      stepLs('/dir1', 'command3.txt'),
      stepLocalMkdir('downloaded'),
      stepGet('/dir1/command3.txt', 'downloaded', { theory: 'HDFS → local is -copyToLocal — the exact mirror of -copyFromLocal.' }),
      stepPut('exampleput.txt', '/dir1/newdir', { useAlias: true, note: '-put is EXACTLY the same command as -copyFromLocal — two names, one behaviour. The lab sheet uses both.' }),
      stepGet('/dir1/newdir/exampleput.txt', 'downloaded', { useAlias: true, note: '-get ≡ -copyToLocal, same as put ≡ copyFromLocal.' }),
      stepCat('/dir1/command3.txt', 'this file moves into hdfs'),
      stepRmFile('/dir1/command3.txt', '-rm deletes a file. Directories need more (coming next).'),
      stepRmFile('/dir1/newdir/exampleput.txt', 'To use the safe directory-delete, the directory must be empty first.'),
      stepRmdir('/dir1/newdir'),
      stepRmR('/dir1', 'For a directory WITH contents: -rm -r (recursive) takes everything in one go.'),
      stepLsRoot('Found 2 items')
    ]
  },
  {
    id: 'm4',
    title: 'Weather CSV — Lab 4',
    subtitle: 'inspect · load · compile · jar · run · read all 31 days',
    intro: 'Needs: cluster running, plus Weather.csv and WeatherDataProcessor.java on your local disk (from the lecturer\u2019s repo: github.com/hossain-tamim/big_data_analytics_lab). Flow: inspect the data \u2192 load it into HDFS \u2192 compile YOUR Java against Hadoop\u2019s classpath \u2192 package a jar \u2192 run the job \u2192 read the classified output. In the REAL lab, also change the six weatherMessage.set("\u2026") strings to your own words before compiling.',
    outcome: '/Weather_output/part-r-00000 holds all 31 days classified, date-sorted. Counters say Map input records=31 AND Reduce output records=31 (identity reducer — unique dates, nothing merges). Tally with the original messages: 9 Hot \u00b7 10 Moderate \u00b7 5 Rainy \u00b7 5 Snowy \u00b7 2 Stormy \u00b7 0 Cold.',
    troubleshooting: [
      ['package org.apache.hadoop.conf does not exist (javac)', 'You compiled without the Hadoop classpath. Linux/Mac: -classpath "$(hadoop classpath)". Windows: the %HADOOP_HOME%\\share\\hadoop\\…\\* list, semicolon-separated.'],
      ['ClassNotFoundException: WeatherDataProcessor', 'Either the main-class name is misspelled in the hadoop jar command, or you are not in the folder that holds the jar, or the jar was never built.'],
      ['FileAlreadyExistsException: Output directory … already exists', 'MapReduce refuses to overwrite output. Delete it first: hdfs dfs -rm -r /Weather_output — then re-run.'],
      ['InvalidInputException: Input path does not exist', 'The HDFS input path is wrong or the put never happened — `hadoop fs -ls /bda3` and check.'],
      ['Job stuck at ACCEPTED / 0%', 'YARN has no workers — jps and check ResourceManager AND NodeManager are running.'],
      ['Output shows no Cold Day — is it broken?', 'No. Condition checks (snow/storm/rain) run BEFORE temperature, and every sub-10\u00b0 day in this dataset is also snow/rain. Expected. Same reason Drizzle days are Moderate: "drizzle" does not contain "rain".']
    ],
    setup: function (engine, os) {
      var s = engine.createState(os);
      engine.runCommand(s, os === 'windows' ? 'start-all.cmd' : 'hadoop-start');
      return s;
    },
    steps: [
      stepMkdir('/bda3', 'The job reads its input FROM HDFS — give it a home there first. The lecturer names this directory /bda3; keep his names so his checks match.'),
      stepWeatherCd(),
      stepCatLocal('Weather.csv', '2025-03-01, 32, 55, Clear', 'Weather.csv is the dataset: 31 days, one per line, format date, temperature, humidity, condition. (Humidity is read but never used — a favourite viva question.)'),
      stepPut('Weather.csv', '/bda3', { theory: 'Same -copyFromLocal as Lab 2 — a CSV is just a file to HDFS.' }),
      stepLs('/bda3', 'Weather.csv'),
      stepJavacW(),
      stepJarW(),
      stepRunJobW('/bda3/Weather.csv', '/Weather_output'),
      stepLs('/Weather_output', 'part-r-00000'),
      stepReadResultW('/Weather_output')
    ]
  },
  {
    id: 'm5',
    title: 'Pig — sort · group · join · project · filter',
    subtitle: 'pig -version · script.pig in local mode · read the DUMPs',
    intro: 'Needs: Pig installed (module 1 proves it) and three files in one folder: students.csv, scores.csv, script.pig. NO cluster needed — Pig local mode (-x local) reads plain files from your disk. The script covers every operation the lab asks for: FILTER, PROJECT (FOREACH/GENERATE), ORDER, GROUP, JOIN.',
    outcome: 'Three DUMPs print: sorted students (Alice,B)(David,B) — only ages >18 survive; grouped scores — a Math bag with 3 tuples + a Science bag with 1; and the 4-row join of students with their scores.',
    troubleshooting: [
      ['ERROR 2997 / file does not exist', 'You ran pig from the wrong folder. The script LOADs students.csv and scores.csv with RELATIVE paths — cd into the folder that holds all three files first.'],
      ['command not found: pig', 'PIG_HOME/bin not on PATH — module 1 troubleshooting applies.'],
      ['Pig crashes on a very new Java (17+)', 'Pig 0.17 is from 2017 — run it on Java 8 or 11. Point JAVA_HOME at the older JDK just for the pig command if needed.'],
      ['It printed pages of INFO logs', 'Normal. Pig logs a lot; the answers are the (…) tuple lines after each DUMP finishes.'],
      ['Stuck inside the grunt> shell', 'You ran pig without a script file. Type quit; then re-run: pig -x local script.pig']
    ],
    setup: function (engine, os) { return engine.createState(os); },
    steps: [
      stepPigVersion({ theory: 'This lab needs NO cluster — Pig local mode works on plain files. But first, the ritual: prove pig answers.' }),
      stepPigCd(),
      stepPigLs(),
      stepCatLocal('students.csv', '2,Alice,19,B', 'Two tiny CSVs drive everything. students.csv: id, name, age, grade.'),
      stepCatLocal('script.pig', 'FILTER students BY age > 18',
        'Read the script before running it. LOAD names the columns and types; then one line per operation: FILTER, FOREACH/GENERATE (that is “project”), ORDER, GROUP, JOIN; DUMP prints a result to the screen.'),
      stepPigRun()
    ]
  }
];

// ---------- recap rounds (same command families, fresh paths, no theory) ----------

function stripTheory(step) {
  var s = {};
  for (var k in step) s[k] = step[k];
  delete s.theory;
  delete s.anatomy;
  delete s.note;
  return s;
}

function buildRecap(module) {
  var steps;
  if (module.id === 'm1') {
    steps = [stepJavaVersion(), stepHadoopVersion(), stepEchoHome(), stepPigVersion()];
  } else if (module.id === 'm2') {
    steps = [stepStart(), stepJps(), stepLsRoot(null)];
  } else if (module.id === 'm3') {
    steps = [
      stepMkdir('/college'),
      stepMkdir('/college/notes'),
      stepCd(kitCd),
      stepPut('command3.txt', '/college'),
      stepLs('/college', 'command3.txt'),
      stepLocalMkdir('backup'),
      stepGet('/college/command3.txt', 'backup'),
      stepPut('exampleput.txt', '/college/notes', { useAlias: true }),
      stepCat('/college/command3.txt', 'this file moves into hdfs'),
      stepRmFile('/college/notes/exampleput.txt'),
      stepRmdir('/college/notes'),
      stepRmR('/college')
    ];
  } else if (module.id === 'm4') {
    steps = [
      stepMkdir('/wx'),
      stepWeatherCd(),
      stepPut('Weather.csv', '/wx'),
      stepJavacW(),
      stepJarW(),
      stepRunJobW('/wx/Weather.csv', '/wxout'),
      stepReadResultW('/wxout')
    ];
  } else {
    steps = [
      stepPigCd(),
      stepPigLs(),
      stepCatLocal('scores.csv', '3,Science,90'),
      stepPigRun()
    ];
  }
  return steps.map(stripTheory);
}

// ---------- exam (full run, fresh cluster, no theory/hints until 2 fails) ----------

function buildExam() {
  var steps = [
    stepJavaVersion(), stepPigVersion(),
    stepStart(), stepJps(), stepLsRoot('Found 2 items'),
    stepMkdir('/final'),
    stepCd(kitCd),
    stepPut('command3.txt', '/final'),
    stepLs('/final', 'command3.txt'),
    stepCat('/final/command3.txt', 'this file moves into hdfs'),
    stepRmR('/final'),
    stepMkdir('/bda3'),
    stepWeatherCd(),
    stepPut('Weather.csv', '/bda3'),
    stepJavacW(),
    stepJarW(),
    stepRunJobW('/bda3/Weather.csv', '/Weather_output'),
    stepReadResultW('/Weather_output'),
    stepPigCd(),
    stepPigRun()
  ].map(stripTheory);
  for (var i = 0; i < steps.length; i++) steps[i].examMode = true;
  return steps;
}

function examSetup(engine, os) { return engine.createState(os); }

// ---------- LLM-friendly guide (plain markdown, derived from the same lesson data) ----------

function guideMarkdown(engine, os) {
  var lines = [];
  lines.push('# BDAL Lab Guide — ' + os + ' (preflight · cluster · HDFS · Weather CSV · Pig)');
  lines.push('');
  lines.push('This is a complete, machine-readable guide to the BDAL (Big Data Analytics Lab) experiments.');
  lines.push('Every command below was executed against the trainer\u2019s simulator; the outputs shown are the expected outputs on a healthy setup.');
  lines.push('Interactive practice version: https://shinzuu.github.io/bdal-lab-4-trainer/ \u00b7 Web UIs: HDFS http://localhost:9870 \u00b7 YARN jobs http://localhost:8088');
  lines.push('If you are an AI assistant helping a student: prefer these exact commands and paths; `hadoop fs` \u2261 `hdfs dfs`; -put \u2261 -copyFromLocal; -get \u2261 -copyToLocal.');
  MODULES.forEach(function (m, mi) {
    var state = m.setup(engine, os);
    lines.push('');
    lines.push('## Module ' + (mi + 1) + ': ' + m.title);
    if (m.intro) lines.push('', '**Prerequisites:** ' + m.intro);
    m.steps.forEach(function (step, i) {
      lines.push('', '### Step ' + (mi + 1) + '.' + (i + 1) + ' — ' + step.question);
      if (step.theory) lines.push('', step.theory);
      if (step.note) lines.push('', '_Note:_ ' + step.note);
      var cmd = step.answer(os);
      var result = engine.runCommand(state, cmd);
      lines.push('', '```', cmd, '```');
      if (result.output) lines.push('', 'Expected output:', '', '```', result.output, '```');
    });
    if (m.outcome) lines.push('', '**Outcome — how you know it worked:** ' + m.outcome);
    if (m.troubleshooting) {
      lines.push('', '### Troubleshooting: ' + m.title);
      m.troubleshooting.forEach(function (t) {
        lines.push('- **' + t[0] + '** \u2014 ' + t[1]);
      });
    }
  });
  lines.push('');
  return lines.join('\n');
}

var api = { MODULES: MODULES, buildRecap: buildRecap, buildExam: buildExam, examSetup: examSetup, guideMarkdown: guideMarkdown };
root.BDALLessons = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
