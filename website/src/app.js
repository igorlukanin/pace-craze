var async       = require('async'),
    compression = require('compression'),
    config      = require('config'),
    ejs         = require('ejs'),
    express     = require('express'),
    moment      = require('moment'),
    none        = require('moment-duration-format'),
    strava      = require('strava-v3'),

    activities  = require('../data/fake_activities.json'),
    port        = config.get('server.port');


process.on('uncaughtException', function(err) {
    console.error(err.stack);
});

var formatResult = function(effort) {
    var distance = (effort.activity.distance / 1000).toFixed(1),
        time     = moment.duration(effort.activity.time, "seconds").format("h:mm:ss"),
        pace     = moment.duration(effort.time / effort.distance * 1000, "seconds").format("h:mm:ss");

    return pace + ' (' + distance + 'km, ' + time + ')';
};

express()
    .use(express.static('public'))
    .use(compression())

    .get('/', function(req, res) {
        res.render('index');
    })

    .get('/auth/strava', function(req, res) {
        res.redirect(strava.oauth.getRequestAccessURL({
            scope:         'public'
        }));
    })

    .get('/auth/strava/complete', function(req, res) {
        var code = req.query.code;

        if (code) {
            strava.oauth.getToken(code, function(err, result) {
                strava.athlete.listActivities({
                    'access_token': result.access_token
                }, function(err) {
                    var efforts = {};

                    activities.map(function(activity) {
                        return activity.best_efforts.map(function(effort) {
                            if (efforts[effort.name] == undefined) {
                                efforts[effort.name] = [];
                            }

                            efforts[effort.name].push({
                                time:     effort.moving_time,
                                distance: effort.distance,
                                activity: {
                                    id:       activity.id,
                                    time:     activity.moving_time,
                                    distance: activity.distance
                                }
                            });
                        });
                    });

                    for (var name in efforts) {
                        if (efforts.hasOwnProperty(name)) {
                            var effort = efforts[name].reduce(function(prev, curr) {
                                return prev.moving_time < curr.moving_time ? prev : curr;
                            });

                            efforts[name] = formatResult(effort);
                        }
                    }

                    res.render('index', {
                        user:       result.athlete,
                        efforts:    efforts
                    });

//                    async.series(activities.map(function(activity) {
//                        return function(callback) {
//                            strava.activities.get({
//                                id: activity.id
//                            }, function(err, activity) {
//                                callback(null, activity);
//                            });
//                        };
//                    }), function(err, detailedActivities) {
//                        res.render('index', {
//                            user:       result.athlete,
//                            activities: detailedActivities
//                        });
//                    });
                });
            });
        }
        else {
            res.render('index'); // TODO: Change to more meaningful solution
        }
    })

    .set('view engine', 'ejs')

    .listen(port, function() {
        console.log("my-best-pace-website started at port " + port);
    });
