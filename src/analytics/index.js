var distanceGroups = {
        '0': [0.0, 0.5],
        '1': [0.5, 2.0],
        '3': [2.0, 4.0],
        '5': [4.0, 6.5],
        '8': [6.5, 9.0],
        '10': [9.0, 13.0],
        '16': [13.0, 18.5],
        '21': [18.5, 23.7],
        '30': [23.7, 38.6],
        '42': [38.6, 44.8],
        '42+': [44.8, Infinity],
        'all': [-Infinity, Infinity]
    },
    minimumActivityCountPerDistance = 3;


var calculateDateStats = (activities) => {
    var stats = {
        min_timestamp: 0,
        max_timestamp: 0,
        years: 0
    };

    if (activities.length == 0) {
        return stats;
    }

    activities.forEach((activity) => {
        if (stats.min_timestamp == 0 || stats.max_timestamp == 0) {
            stats.min_timestamp = calculateDateGroup(activity);
            stats.max_timestamp = activity.start_timestamp;
        }

        stats.min_timestamp = Math.min(stats.min_timestamp, calculateDateGroup(activity));
        stats.max_timestamp = Math.max(stats.max_timestamp, activity.start_timestamp);
    });

    stats.years = (stats.max_timestamp - stats.min_timestamp) / (60 * 60 * 24 * 365);

    return stats;
};


var calculateDateGroup = (activity) => {
    var date = new Date(1000 * activity.start_timestamp);
    var month = Math.floor(date.getMonth() / 1) * 1;
    var firstDayOfMonth = new Date(date.getFullYear(), month, 1);

    return firstDayOfMonth.getTime() / 1000;
};


var calculateDistanceGroup = (activity) => {
    for (var name in distanceGroups) {
        if (distanceGroups.hasOwnProperty(name) && name != 'all' &&
            distanceGroups[name][0] <= activity.distance_km &&
            distanceGroups[name][1] > activity.distance_km
        ) {
            return name;
        }
    }
};


var calculatePace = (activity) => activity.time_m / activity.distance_km;


var calculateAwards = (activities) => {
    var awards = {
        hm_count: 0,
        ytd_hm_count: 0,
        m_count: 0,
        ytd_m_count: 0,
        total_running_days: 0,
        ytd_total_running_days: 0
    };

    activities.forEach((activity) => {
        var firstDayOfYearTimestamp = new Date(new Date().getFullYear(), 0, 1) / 1000;

        if (activity.distance_km >= 21.0975) {
            awards.hm_count++;

            if (activity.start_timestamp >= firstDayOfYearTimestamp) {
                awards.ytd_hm_count++;
            }
        }

        if (activity.distance_km >= 42.195) {
            awards.m_count++;

            if (activity.start_timestamp >= firstDayOfYearTimestamp) {
                awards.ytd_m_count++;
            }
        }

        awards.total_running_days += activity.time_m / (60 * 24);

        if (activity.start_timestamp >= firstDayOfYearTimestamp) {
            awards.ytd_total_running_days += activity.time_m / (60 * 24);
        }
    });

    return awards;
};


var calculateData = (athlete, activities) => {
    var dateStats = calculateDateStats(activities),
        distanceStats = {};

    for (var name in distanceGroups) {
        if (distanceGroups.hasOwnProperty(name)) {
            distanceStats[name] = {
                relevant: true,
                count: 0,
                ratio: 0,
                date_groups: {}
            };
        }
    }

    activities = activities
        .filter((activity) => activity.distance_km > 0)
        .map((activity) => {
            activity.date_group = calculateDateGroup(activity);
            activity.distance_group = calculateDistanceGroup(activity);
            activity.pace_m_km = calculatePace(activity);
            return activity;
        })
        .filter((activity) => activity.pace_m_km > 2 && activity.pace_m_km < 8) // 1 km world record is 2:11.96, 6 km/h is walking, not running
        .map((activity) => {
            var distanceCell = distanceStats[activity.distance_group];
            distanceCell.count++;
    
            if (distanceCell.date_groups[activity.date_group] == undefined) {
                distanceCell.date_groups[activity.date_group] = {
                    count: 0,
                    min_pace: 0,
                    max_pace: 0,
                    mean_pace: 0,
                    activities: []
                };
            }
    
            distanceCell.date_groups[activity.date_group].count++;
            distanceCell.date_groups[activity.date_group].activities.push(activity);
    
            var allCell = distanceStats.all;
            allCell.count++;
    
            if (allCell.date_groups[activity.date_group] == undefined) {
                allCell.date_groups[activity.date_group] = {
                    count: 0,
                    min_pace: 0,
                    max_pace: 0,
                    mean_pace: 0,
                    activities: []
                };
            }
    
            allCell.date_groups[activity.date_group].count++;
            allCell.date_groups[activity.date_group].activities.push(activity);
    
            delete activity.raw_data;
            return activity;
        });

    var distanceRatios = [];

    for (name in distanceGroups) {
        if (distanceGroups.hasOwnProperty(name)) {
            distanceCell = distanceStats[name];

            distanceCell.ratio = distanceCell.count / activities.length;
            distanceCell.relevant = distanceCell.count >= minimumActivityCountPerDistance;

            if (name != 'all') {
                distanceRatios.push([ name, distanceCell.ratio ]);
            }

            for (var date in distanceCell.date_groups) {
                if (distanceCell.date_groups.hasOwnProperty(date)) {
                    var dateCell = distanceCell.date_groups[date];

                    dateCell.min_pace = dateCell.activities.reduce(function(min, current) {
                        return min ? Math.min(min, current.pace_m_km) : current.pace_m_km;
                    }, 0);

                    dateCell.max_pace = dateCell.activities.reduce(function(max, current) {
                        return max ? Math.max(max, current.pace_m_km) : current.pace_m_km;
                    }, 0);

                    dateCell.mean_pace = dateCell.activities.reduce(function(partialSum, current) {
                        return partialSum + current.pace_m_km / dateCell.activities.length;
                    }, 0);
                }

                delete dateCell.activities;
            }
        }
    }

    // TODO: Temporary code, refactoring needed
    var distances = [];

    for (name in distanceGroups) {
        if (distanceGroups.hasOwnProperty(name) && name != 'all') {
            var group = distanceStats[name];

            distances.push({
                name: name,
                distance: +name,
                ratio: group.ratio.toFixed(2),
                count: group.count,
                relevant: group.relevant
            });
        }
    }

    var awards = calculateAwards(activities);

    return {
        activities: activities,
        distances: distances,
        date_stats: dateStats,
        distance_stats: distanceStats,
        awards: awards
    };
};


module.exports = {
    calculate: calculateData
};