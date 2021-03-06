var express = require('express');
var app = express();
var fs = require('fs');

var conf = JSON.parse(fs.readFileSync('./conf.json'));

var bodyParser = require('body-parser');
var cors = require('cors');
app.use(cors());

app.options('*', cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var mustache = require('mustache-express');
app.engine('html', mustache());
app.set('view engine', 'html');

app.set('views', __dirname+'/views');
app.use(express.static(__dirname+'/views/public'));

var mysql = require('mysql');
var connection = mysql.createPool({
	connectionLimit: 5,
	host: conf.db.host,
	user: conf.db.username,
	password: conf.db.password,
	database: conf.db.database
});

var APPLICATIONS = [{
	type: 'full',
	key: conf.full_key
}];

app.use('/api', function(req, res, err){
	if(req.application.type !== 'full'){
		return res.sendStatus(404);
	}

	next();
});

app.get('/conjugate/:verb', function (req, res, err){
	var query = 'SELECT * FROM `conjugated` WHERE word_id IN (SELECT id FROM `radical` WHERE radical=?)';

	connection.query(query, [req.params.verb], function(err, rows, fields){
		if(err){
			console.error(err);
			return res.status(500).json({error:{message:`Error requesting conjugations for verb ${req.params.verb}`}, code:500});
		}

		var resp = {
			verb : req.params.verb,
			conjugations :{

			}
		};

		for(var el of rows){
			if(!(el.time in resp.conjugations)){
				resp.conjugations[el.time] = {};
			}

			resp.conjugations[el.time][el.person] = el.conjugation;
		}

		return res.json(resp);
	});
});

app.post('/radicalize', function(req, res, err){
	if(!('conjugations' in req.body) || (!req.body.conjugations)){
		return res.sendStatus(400);
	}

	var result = {
		conjugations: req.body.conjugations,
	};

	var counter = req.body.conjugations.length;

	for(var conjug of req.body.conjugations){
		var query = 'SELECT DISTINCT RA.* FROM radical RA left join conjugated CO on CO.word_id = RA.id where CO.conjugation=?';
		connection.query(query, conjug, (function(conjug){
			return function(err ,rows, fields){
				if(err){
					console.error(err, rows);
					counter--;
					return;
				}

				if(rows.length === 0){
					result[conjug] = false;
				} else if(rows.length === 1) {
					result[conjug] = rows[0].radical
				} else {
					result[conjug] = [];
					var seen_ids = [];
					for(var r of rows){
						if(seen_ids.indexOf(r.id) > -1){
							continue;
						}
						result[conjug].push(r.radical);
						seen_ids.push(r.id);
					}
				}

				counter--;
				if(counter == 0){
					return res.status(200).json(result);
					
				}
			}
		})(conjug));	
	}
});

app.post('/radicalize/replace', function(req, res, err){
	if(!('conjugations' in req.body) || (!req.body.conjugations)){
		return res.sendStatus(400);
	}

	var result = [];

	var query = 'SELECT DISTINCT RA.*, CO.conjugation as word FROM conjugated CO left join radical RA on CO.word_id = RA.id where CO.conjugation IN (??);';
	connection.query(query, req.body.conjugations, (function(conjug){
		return function(err ,rows, fields){
			if(err){
				console.error(err, rows);
				return;
			}

			for(var row of rows){
				var i = req.body.conjugations.indexOf(row.word);
				if(i > -1){
					req.body.conjugations[i] = row.radical;
				}
			}

			return res.status(200).json(req.body.conjugations);	
		}
	})(conjug));	
	
});

app.get('/radicalize/:conjugated_verb', function(req, res, err){
	var query = 'SELECT DISTINCT RA.* FROM radical RA left join conjugated CO on CO.word_id = RA.id where CO.conjugation=?';
	connection.query(query, [req.params.conjugated_verb], function(err ,rows, fields){
		if(err || !rows[0]){
			console.error(err);
			return res.status(500).json({error:{message:`Error requesting radical for verb ${req.params.conjugated_verb}`}, code:500});
		}

		var resp = {
			conjugated: req.params.conjugated_verb,
		};

		if(rows.length === 1){
			resp.radical = rows[0].radical
		} else {
			resp.radicals = [];
			var seen_ids = [];
			for(var r of rows){
				if(seen_ids.indexOf(r.id) > -1){
					continue;
				}
				resp.radicals.push(r.radical);
				seen_ids.push(r.id);
			}
		}

		return res.status(200).json(resp);
	});
});

app.get('/dump', function(req, res, err){
	var options = {
		root: __dirname,
		dotfiles: 'deny',
		headers: {
			'x-timestamp': Date.now(),
			'x-sent': true,
			'Content-Disposition': 'attachment; filename=conjugation_fr_dump.sql'
		}
	};

	var fileName = req.params.name;
	res.sendFile('conjugation_fr_dump.sql', options, function (err) {
		if (err) {
			console.log(err);
			res.status(err.status).end();
		} else {
			console.log('Sent:', fileName);
		}
	});
});

app.get('/api/reload', function (req, res, err) {
	reloadApps();
	res.sendStatus(204);
});

app.post('/api/app', function(req, res, err){
	if(!('type' in req.body)){
		res.sendStatus(400);
	}

	var key = genUUID(); 

	APPLICATIONS.push({
		type: req.body.type,
		key: key
	});

	fs.writeFileSinc('./applications.json', JSON.stringify(APPLICATIONS));
	res.status(200).send(key);
})

function reloadApps(){
	APPLICATIONS = JSON.parse(fs.readFileSync('./applications.json'));
}

function genUUID(){
	function s4(){
		return (Math.floor((1+Math.random()) * 0x10000)).toString(16).substring(1);
	}

	return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

Object.defineProperty(Array.prototype, 'findObjectByProperty', {
	enumerable: false,
	value: function(prop, val){
		for(var el of this){
			if(el[prop] && el[prop] === val){
				return el;
			}
		}
		return null;
	}	
});

app.listen(3500, function(){
	console.log(`Server listening on port ${3500}!`);
});