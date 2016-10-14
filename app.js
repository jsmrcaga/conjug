var fs = require('fs');
var verbs = JSON.parse(fs.readFileSync('./data.json'));

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

var reg = /([^\s]*)$/i;

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
			path: `/conjuguer-verbe-${verb}`,
			method: 'GET'
		}, function(st, res){
			var $ = cheerio.load(res);
			var conjug = $('.conjug');

			for(var i = 0; i < 6; i++){
				for(var j = 0; j < 6; j++){
					var conjug = conjug[j].innerText;
					console.log('Adding', conjug, '...');
					insertConjug(conjug, verb.id, personnes[j], times[i], v_index);
				}
			}

		});
	});
}

function insertVerb(index, callback){
	var query = 'INSERT INTO radical VALUES(null, ?);';
	connection.query(query, [verbs[index]], function(err, rows, fields){
		if(err){
			return console.error('Error inserting verb', err);
		}
		callback(fields.insertId, index);
	});
}

function insertConjug(conjug, verb_id, person, time, v_index){
	var query = 'INSERT INTO conjugated VALUES(null, ?, ?, ?, ?)';
	connection.query(query, [verb_id, conjug, person, time], function(err, rows, fields){
		if(err){
			return console.error(err);
		}

		console.log('SUCCESSFULLY ADDED', conjug);
		getVerb(vindex+1);
	})
}

