var fs = require('fs');
var verbs = JSON.parse(fs.readFileSync('./data.json'));

var fishingrod = require('fishingrod');

var mysql = require('mysql');
var connection = mysql.createConnection({
	host: 'localhost',
	user:'root',
	password: 'phantomoftheopera',
	database: 'conjugation'
});

connection.connect();

var cheerio = require('cheerio');
var times = ['indicatif', 'futur', 'imparfait', 'passe-simple','sub-pres', 'sub-imparfait', 'conditionnel', 'imperatif']
var personnes = ['je', 'tu', 'il/elle', 'nous', 'vous', 'ils'];

var reg = /([^\s']*)$/i;

function getVerb(index){
	if(!verbs[index]){
		connection.end();
		console.log('Done');
	}

	if(verbs[index].indexOf('-')>-1 || verbs[index].indexOf("'")>-1){
		console.error('Ignoring', verbs['index']);
		getVerb(index+1);
		return;
	}

	console.log('Inserting verb', verbs[index]);
	insertVerb(index, function(id, v_index){
		fishingrod.fish({
			https: false,
			host: 'conjugateur.fr',
			path: `/conjuguer-verbe-${verbs[v_index]}`,
			method: 'GET'
		}, function(st, res){
			var $ = cheerio.load(res);
			var conjug = $('.conjug');

			for(var i = 0; i <7; i++){
				for(var j = 0; j < 6; j++){
					if(!conjug[j] || !conjug[j].firstChild){
						continue;
					}
					var conjug = conjug[j].firstChild.data + conjug[j].firstChild.next.firstChild.data;
					console.log('Adding', conjug, '...');
					insertConjug(reg.exec(conjug)[1], id, personnes[j], times[i]);
				}
			}

			continueparsing(v_index);

		});
	});
}

function continueparsing(v_index){
	getVerb(v_index+1);
}

function insertVerb(index, callback){
	var query = 'INSERT INTO radical VALUES(null, ?);';
	connection.query(query, [verbs[index]], function(err, rows, fields){
		if(err){
			return console.error('Error inserting verb', err);
		}
		callback(rows.insertId, index);
	});
}

function insertConjug(conjug, verb_id, person, time){
	var query = 'INSERT INTO conjugated VALUES(null, ?, ?, ?, ?)';
	connection.query(query, [verb_id, conjug, person, time], function(err, rows, fields){
		if(err){
			return console.error(err);
		}

		console.log('SUCCESSFULLY ADDED', conjug);
	})
}

getVerb(0);