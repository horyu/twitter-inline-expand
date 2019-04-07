// ==UserScript==
// @name        Twitter Inline Expansion
// @namespace   https://github.com/horyu
// @description Inline-expansion of :orig (full-resolution) twitter images
// @include     https://twitter.com/*
// @version     0.4.3
// @run-at      document-start
// @noframes
// @grant       none
// ==/UserScript==

'use strict';

function init() {
	const config = { subtree: true, childList: true };

	let observer = new MutationObserver(mutationObserverCallback);
	observer.observe(document.documentElement, config);

	document.addEventListener("DOMContentLoaded", ready);
	document.addEventListener("click", thumbToggleHandler, true);
	document.addEventListener("keypress", keyboardNav);
}

//
// Util
//

const cssPrefix = "mediatweaksuserscript";

function prefixed(str) {
	return cssPrefix + str;
}

//
// mutationObserverCallback
//

const TweetImageSelector = ".tweet .js-adaptive-photo img";

function mutationObserverCallback(mutations) {
	try {
		for(let mutation of mutations) {
			for(let node of [mutation.target, ...mutation.addedNodes]) {
				if(node.nodeType != Node.ELEMENT_NODE)
					continue;

				onAddedNode(node);
				for(let subNode of node.querySelectorAll(TweetImageSelector))
					onAddedNode(subNode);
			}
		}
	} catch(e) {
		console.log(e);
	}
}

function onAddedNode(node) {
	if(node.matches(TweetImageSelector)) {
		visitOnce(node, () => {
			addImageControls(node.closest(".tweet"), node);
		});
	}
}

let alreadyVisited = new WeakSet();

function visitOnce(element, func) {
	if(alreadyVisited.has(element))
		return;
	alreadyVisited.add(element);
	func();
}

function addImageControls(tweetContainer, image) {
	let src;
	if(image.localName == "a") {
		src = image.style.backgroundImage.match(/^url\("(.*)"\)$/)[1];
	} else {
		src = image.src;
	}

	let origSrc = src + ":orig";
	let div = controlContainer(tweetContainer);

	div.insertAdjacentHTML("beforeend", `
		<a class="${cssPrefix}-orig-link ${cssPrefix}-thumb" data-${cssPrefix}-small="${src}" href="${origSrc}"><img src="${src}"></a>
	`);
}

function controlContainer(target) {
	let div = target.querySelector(`.${cssPrefix}-thumbs-container`);
	if(!div) {
		div = document.createElement("div");
		target.appendChild(div);
		div.className = prefixed("-thumbs-container");
	}

	return div;
}

//
// ready
//

const style = `
.${cssPrefix}-thumbs-container {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
}

a.${cssPrefix}-orig-link {
	padding: 5px;
}

.${cssPrefix}-orig-link.${cssPrefix}-thumb img {
	max-width: 60px;
	max-height: 60px;
	vertical-align: middle;
}

a.${cssPrefix}-expanded {
	width: -moz-fit-content;
	width: fit-content;
}

a.${cssPrefix}-expanded img {
	width: -moz-fit-content;
	width: fit-content;
	max-width: 95vw;
}

.${cssPrefix}-focused {
	outline: 3px solid green !important;
}

.${cssPrefix}-shortcuts {
	list-style:initial;
	padding-left: 1em;
}

`;

const info = `
Userscript Keyboard Shortcuts:
<ul class="${prefixed("-shortcuts")}">
<li>Navigate between posts with images with WD or Up/Down arrows
<li>Expand with Q or Spacebar
<li>Download with E
</ul>
`;

function ready() {
	let styleEl = document.createElement("style");
	styleEl.textContent = style;
	document.head.append(styleEl);
	document.querySelector(".ProfileSidebar").insertAdjacentHTML("beforeend", info);
}

//
// thumbToggleHandler
//

function thumbToggleHandler(event) {
	if(event.button != 0)
		return;
	let link = event.target.closest(`.${cssPrefix}-orig-link`);
	if(!link)
		return;

	event.stopImmediatePropagation();
	event.preventDefault();

	thumbToggle(link);
}


function thumbToggle(link) {
	let img = link.querySelector("img");

	return new Promise((res, rej) => {
		if(link.classList.contains(prefixed("-expanded"))) {
			img.src = link.dataset[cssPrefix + "Small"];
			link.classList.add(prefixed("-thumb"));
			link.classList.remove(prefixed("-expan;ded"));
			res(link);
		} else {
			let f = () => {
				link.classList.add(prefixed("-expanded"));
				link.classList.remove(prefixed("-thumb"));
				img.removeEventListener("load", f);
				res(link);
			};

			img.addEventListener("load", f);
			img.src = link.href;
		}

	});
}

//
// keyboardNav
//

function keyboardNav(e) {
	// skip keyboard events when in inputs
	if(e.target.isContentEditable || ("selectionStart" in document.activeElement))
		return;

	let focus = null;
	let prevent = false;
	if(e.key == "w" || e.key == "ArrowUp" ) {
		focus = moveFocus(-1);
		prevent = true;
	}

	if(e.key == "s" || e.key == "ArrowDown" ) {
		focus = moveFocus(1);
		prevent = true;
	}

	if(e.key == "q" || e.key == " ") {
		let cf = currentFocus();
		let expandable = cf && Array.from(cf.querySelectorAll("." + prefixed("-thumb"))) || [];
		let first = expandable.map((ex) => thumbToggle(ex)).shift();
		if(first)
			first.then((f) => {
				setFocus(f, cf);
			});
		prevent = true;
	}

	if(focus)
		setFocus(focus);

	if(prevent)
		e.preventDefault();
}

function setFocus(focus, expect) {
	let cf = currentFocus();
	if(expect && cf != expect)
		return;
	if(cf)
		cf.classList.remove(prefixed("-focused"));
	focus.classList.add(prefixed("-focused"));
	focus.scrollIntoView();
	let offset = document.querySelector(".ProfileCanopy-inner");
	offset = offset && offset.scrollHeight;
	if(offset) {
		offset = offset + 5;
		window.scrollBy(0, -offset);
	}

}

function currentFocus() {
	return document.querySelector(`.${prefixed("-focused")}`);
}

function moveFocus(direction) {
	let focusable = Array.from(document.querySelectorAll(`.tweet.has-content, .${prefixed("-expanded")}`));
	let idx = -1;
	let cf = currentFocus();
	if(cf)
		idx = focusable.indexOf(cf);
	idx += direction;
	idx = mod(idx, focusable.length);
	let newFocus = focusable[idx];

	return newFocus;
}

function mod(n, m) {
	return ((n % m) + m) % m;
}

//
// init()
//

init();
