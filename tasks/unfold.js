/*
 * grunt-unfold
 * https://github.com/christian.rondeau/grunt-unfold
 *
 * Copyright (c) 2013 Christian Rondeau
 * Licensed under the MIT license.
 */

'use strict';

var _ = require('lodash');

var expressions = {
	whitespace: /[\t ]*/,
	tagBegin: /<!--[ \t]*unfold:\w+ .*(?=-->)[ \t]*-->/,
	tagContent: /[\s\S]*/,
	tagEnd: /<!--[ \t]*\/unfold[ \t]*-->/
};

expressions.section = new RegExp(expressions.whitespace.source + expressions.tagBegin.source + expressions.tagContent.source + expressions.tagEnd.source, 'g');

module.exports = function (grunt, options) {
	var that = {};
	
	function getTypeFromTagBegin(tagBegin) {
		var indexOfType = tagBegin.indexOf('unfold:') + 7;
		var type = tagBegin.substring(indexOfType, tagBegin.indexOf(' ', indexOfType));
		
		if(type === 'unfold') {
			throw new Error('"unfold" cannot be a type');
		}
		
		return type;
	}
	
	function detectLineBreakString(section, whitespace, tagBegin) {
		var lineBreak = section.substr(whitespace.length + tagBegin.length, 2);
		return lineBreak !== '\r\n' ? '\n' : lineBreak;
	}
	
	function getTypeDefinition(type) {
		var typeDefinition = options.types[type];
		if(!typeDefinition) {
			throw new Error('No type defined for "' + type + '"');
		}
		if(!typeDefinition.template) {
			throw new Error('No template defined for type "' + type + '"');
		}
		return typeDefinition;
	}
	
	function getPathFilterFromTagBegin(tagBegin, type) {
		return tagBegin.substring(tagBegin.indexOf(type) + type.length, tagBegin.indexOf('-->')).trim();
	}
	
	function buildLinesListFromGlobbingPattern(pathFilter, typeDefinition) {
		var lines = [];
		grunt.file.expand({
			cwd: options.root
		}, pathFilter).forEach(function (path) {
			lines.push(typeDefinition.template.replace('$PATH$', path));
		});
		return lines;
	}

	that.processSection = function (section) {
		var whitespace = section.match(/^[\t ]*/)[0];
		var tagBegin = section.match(expressions.tagBegin)[0];
		var tagEnd = section.match(expressions.tagEnd)[0];
		var lineBreak = detectLineBreakString(section, whitespace, tagBegin);
		var type = getTypeFromTagBegin(tagBegin);
		var typeDefinition = getTypeDefinition(type);
		var pathFilter = getPathFilterFromTagBegin(tagBegin, type);
		
		var lines = [];
		lines.push(tagBegin);
		lines = lines.concat(buildLinesListFromGlobbingPattern(pathFilter, typeDefinition));
		lines.push(tagEnd);

		return _.map(lines, function (line) {
			return whitespace + line;
		}).join(lineBreak);
	};

	that.processContent = function (content) {
		return content.replace(expressions.section, function (section) {
			return that.processSection(section);
		});
	};

	that.processFile = function (src) {
		var content = grunt.file.read(src);
		var result = that.processContent(content);
		if (content !== result) {
			grunt.file.write(src, result);
		}
	};

	that.processFiles = function (files) {
		_.forEach(files, function (file) {
			_.forEach(file.src, function (src) {
				if (!grunt.file.exists(src)) {
					grunt.log.warn('File "' + src + '" not found.');
				} else {
					grunt.log.writeln('Processing "' + src + '"');
					that.processFile(src);
				}
			});
		});
	};

	return that;
};