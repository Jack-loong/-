/**************************
显示豆瓣评分
***************************/

let $ = nobyda();

async function QueryRating(body, play) {
	try {
		const ratingEnabled = $.read('BiliDoubanRating') === 'false';
		if (!ratingEnabled && play.title && body.data && body.data.badge_info) {
			const [t1, t2] = await Promise.all([
				GetRawInfo(play.title.replace(/\uff08\u50c5[\u4e00-\u9fa5]+\u5340\uff09/, '')),
				GetRawInfo(play.origin_name)
			]);
			const exYear = body.data.publish.release_date_show.split(/^(\d{4})/)[1];
			const info1 = (play.staff && play.staff.info) || '';
			const info2 = (play.actor && play.actor.info) || '';
			const info3 = (play.celebrity && play.celebrity.map(n => n.name).join('/')) || '';
			const filterInfo = [play.title, play.origin_name, info1 + info2 + info3, exYear];
			const [rating, folk, name, id, other] = ExtractMovieInfo([...t1, ...t2], filterInfo);
			const limit = JSON.stringify(body.data.modules)
				.replace(/"\u53d7\u9650"/g, `""`).replace(/("area_limit":)1/g, '$10');
			body.data.modules = JSON.parse(limit);
			body.data.detail = body.data.new_ep.desc.replace(/连载中,/, '');
			body.data.badge_info.text = `⭐️ 豆瓣：${!$.is403?`${rating||'无评'}分 (${folk||'无评价'})`:`查询频繁！`}`;
			body.data.evaluate = `${body.data.evaluate||''}\n\n豆瓣评分搜索结果: ${JSON.stringify(other,0,1)}`;
			body.data.new_ep.desc = name;
			body.data.styles.unshift({
				name: "⭐️ 点击此处打开豆瓣剧集详情页",
				url: `https://m.douban.com/${id?`movie/subject/${id}/`:`search/?query=${encodeURI(play.title)}`}`
			});
		}
	} catch (err) {
		console.log(`Douban rating: \n${err}\n`);
	} finally {
		$done({
			body: JSON.stringify(body)
		});
	}
}

function ExtractMovieInfo(ret, fv) {
	const sole = new Set(ret.map(s => JSON.stringify(s))); //delete duplicate
	const f1 = [...sole].map(p => JSON.parse(p))
		.filter(t => {
			t.accuracy = 0;
			if (t.name && fv[0]) { //title
				if (t.name.includes(fv[0].slice(0, 4))) t.accuracy++;
				if (t.name.includes(fv[0].slice(-3))) t.accuracy++;
			}
			if (t.origin && fv[1]) { //origin title
				if (t.origin.includes(fv[1].slice(0, 4))) t.accuracy++;
				if (t.origin.includes(fv[1].slice(-3))) t.accuracy++;
			}
			if (t.pd && fv[2]) { //producer or actor
				const len = t.pd.split('/').filter(c => fv[2].includes(c));
				t.accuracy += len.length;
			}
			if (t.year && fv[3] && t.year == fv[3]) t.accuracy++; //year
			return Boolean(t.accuracy);
		});
	let x = {}; //assign most similar
	const f2 = f1.reduce((p, c) => c.accuracy > p ? (x = c, c.accuracy) : p, 0);
	return [x.rating, x.folk, x.name, x.id, f1];
}

function GetRawInfo(t) {
	let res = [];
	let st = Date.now();
	return new Promise((resolve) => {
		if (!t) return resolve(res);
		$.get({
			url: `https://www.douban.com/search?cat=1002&q=${encodeURIComponent(t)}`,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15',
				'Cookie': JSON.stringify(st)
			}
		}, (error, resp, data) => {
			if (error) {
				console.log(`Douban rating: \n${t}\nRequest error: ${error}\n`);
			} else {
				if (/\u767b\u5f55<\/a>\u540e\u91cd\u8bd5\u3002/.test(data)) $.is403 = true;
				let s = data.replace(/\n| |&#\d{2}/g, '')
					.match(/\[(\u7535\u5f71|\u7535\u89c6\u5267)\].+?subject-cast\">.+?<\/span>/g) || [];
				for (let i = 0; i < s.length; i++) {
					res.push({
						name: s[i].split(/\}\)">(.+?)<\/a>/)[1],
						origin: s[i].split(/\u540d:(.+?)(\/|<)/)[1],
						pd: s[i].split(/\u539f\u540d.+?\/(.+?)\/\d+<\/span>$/)[1],
						rating: s[i].split(/">(\d\.\d)</)[1],
						folk: s[i].split(/(\d+\u4eba\u8bc4\u4ef7)/)[1],
						id: s[i].split(/sid:(\d+)/)[1],
						year: s[i].split(/(\d+)<\/span>$/)[1]
					})
				}
				let et = ((Date.now() - st) / 1000).toFixed(2);
				console.log(`Douban rating: \n${t}\n${res.length} movie info searched. (${et} s)\n`);
			}
			resolve(res);
		})
	})
}

function nobyda() {
	const isHTTP = typeof $httpClient != "undefined";
	const isLoon = typeof $loon != "undefined";
	const isQuanX = typeof $task != "undefined";
	const isSurge = typeof $network != "undefined" && typeof $script != "undefined";
	const ssid = (() => {
		if (isQuanX && typeof($environment) !== 'undefined') {
			return $environment.ssid;
		}
		if (isSurge && $network.wifi) {
			return $network.wifi.ssid;
		}
		if (isLoon) {
			return JSON.parse($config.getConfig()).ssid;
		}
	})();
	const notify = (title, subtitle, message) => {
		console.log(`${title}\n${subtitle}\n${message}`);
		if (isQuanX) $notify(title, subtitle, message);
		if (isHTTP) $notification.post(title, subtitle, message);
	}
	const read = (key) => {
		if (isQuanX) return $prefs.valueForKey(key);
		if (isHTTP) return $persistentStore.read(key);
	}
	const adapterStatus = (response) => {
		if (!response) return null;
		if (response.status) {
			response["statusCode"] = response.status;
		} else if (response.statusCode) {
			response["status"] = response.statusCode;
		}
		return response;
	}
	const getPolicy = (groupName) => {
		if (isSurge) {
			if (typeof($httpAPI) === 'undefined') return 3;
			return new Promise((resolve) => {
				$httpAPI("GET", "v1/policy_groups/select", {
					group_name: encodeURIComponent(groupName)
				}, (b) => resolve(b.policy || 2))
			})
		}
		if (isLoon) {
			if (typeof($config.getPolicy) === 'undefined') return 3;
			const getName = $config.getPolicy(groupName);
			return getName || 2;
		}
		if (isQuanX) {
			if (typeof($configuration) === 'undefined') return 3;
			return new Promise((resolve) => {
				$configuration.sendMessage({
					action: "get_policy_state"
				}).then(b => {
					if (b.ret && b.ret[groupName]) {
						resolve(b.ret[groupName][1]);
					} else resolve(2);
				}, () => resolve());
			})
		}
	}
	const setPolicy = (group, policy) => {
		if (isSurge && typeof($httpAPI) !== 'undefined') {
			return new Promise((resolve) => {
				$httpAPI("POST", "v1/policy_groups/select", {
					group_name: group,
					policy: policy
				}, (b) => resolve(!b.error || 0))
			})
		}
		if (isLoon && typeof($config.getPolicy) !== 'undefined') {
			const set = $config.setSelectPolicy(group, policy);
			return set || 0;
		}
		if (isQuanX && typeof($configuration) !== 'undefined') {
			return new Promise((resolve) => {
				$configuration.sendMessage({
					action: "set_policy_state",
					content: {
						[group]: policy
					}
				}).then((b) => resolve(!b.error || 0), () => resolve());
			})
		}
	}
	const get = (options, callback) => {
		if (isQuanX) {
			options["method"] = "GET";
			$task.fetch(options).then(response => {
				callback(null, adapterStatus(response), response.body)
			}, reason => callback(reason.error, null, null))
		}
		if (isHTTP) {
			if (isSurge) options.headers['X-Surge-Skip-Scripting'] = false;
			$httpClient.get(options, (error, response, body) => {
				callback(error, adapterStatus(response), body)
			})
		}
	}
	return {
		getPolicy,
		setPolicy,
		isSurge,
		isQuanX,
		isLoon,
		notify,
		read,
		ssid,
		get
	}
}