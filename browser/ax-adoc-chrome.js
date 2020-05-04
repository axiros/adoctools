// @format
/*
 * Enhances he asciidoctor browser extension for:
 * - side toc, incl bootstrap styles
 * - theme selectors for adoc and code highlighting, persistent over sessions
 *
 * Save this on your host and tell the chrome extension to use it as prerendering script.
 * Disable any style in the extension!
 *
 * skins from https://github.com/darshandsoni/asciidoctor-skins
 *
 *
 */
// TODO: Encapsulate as module, we spam the namespace. But this is (not yet) a real js app
//
// ----------------------------------------------------------------------------- Config

// CAUTION: server cors necessary!
// for self hosting, e.g. nginx:  add_header Access-Control-Allow-Origin '*';
// Server serves: /stylesheets/.. and /highlightjs/... under the base url
var SERVER_URL =
    'https://raw.githubusercontent.com/axiros/adoctools/master/server/asciidoctor'

var TOC_LEFT = 'always' // ['always', ':toc:' ':toc: left', 'never']
var THEMES = 'always' // ['always', ':themes:', 'never']

// --------------------------------------------------------------------------- Internal
var D = document

//var S = localStorage
var byid = function(id) {
    return D.getElementById(id)
}
var dflt_theme = {adoc: 'asciidoctor', code: 'github'}

function docbody() {
    return D.getElementsByTagName('body')[0]
}
function is_set(s, getval = false) {
    // get attribute set bool or its value
    let i = docbody().innerText.split(s)
    if (i.length == 1) return false
    if (!getval) return true
    return i[1].split('\n')[0].replace(' ', '')
}
function S() {
    // we can't ref local storage global, crashes all when sandboxed:
    return localStorage
}
function get_cur_theme(typ) {
    let cur_theme = S().getItem('cur_theme' + typ)
    return cur_theme ? cur_theme : dflt_theme[typ]
}
function remember_cur_theme(t, typ) {
    S().setItem('cur_theme' + typ, t)
}

function allthemes() {
    return D.TH.index
}

function repl(s, l) {
    for (let i = 0; i < l.length; i++) s = s.replace(l[i][0], l[i][1])
    return s
}

function make_theme_switchers() {
    // theme switchers
    // wait until loaded, comes from server
    // if (!allthemes()['adoc']) {
    //     // don't know how to find when the extension is done rendering :-/
    //     return setTimeout(make_theme_switchers, 100)
    // }
    let switchers = D.createElement('table')
    switchers.id = 'switchers'
    docbody().appendChild(switchers)
    let tr, f, o, skin_name, ak, skins, cur_theme, switcher, dropdown, typ, m, d
    types = ['adoc', 'code']
    for (let j = 0; j < 2; j++) {
        typ = types[j]
        cur_theme = get_cur_theme(typ)
        switcher = D.createElement('td')
        tr = D.createElement('tr')
        switchers.appendChild(tr)
        tr.appendChild(switcher)
        switcher.id = typ + '_switcher'
        ak = {adoc: 's', code: 'c'}[typ]
        d =
            '\n<select title="ddtitle" name="switcher_dropdown" id="ddid" accesskey="ddaccesskey"'
        d += ' onchange="set_theme(this.value, \'ddtyp\')">\n'
        m = D.TH[typ]
        d = repl(d, [
            ['ddaccesskey', m.ddaccesskey],
            ['ddtitle', m.ddtitle],
            ['ddid', m.ddid],
            ['ddtyp', typ],
        ])
        skins = allthemes()[typ]
        if (!skins) debugger
        for (let i = 0; i < skins.length; i++) {
            f = skins[i]
            sel = cur_theme == f ? ' selected ' : ''
            o = '\n<option value="_f_" _sel_>_f2_</option>\n'
            d += repl(o, [
                ['_f_', f],
                ['_f2_', f],
                ['_sel_', sel],
            ])
        }
        d += '</select>\n      '
        switcher.innerHTML = d
    }
}

function ext_has_css_set() {
    // is the original style set? if so: dust it:
    let a = document.getElementById('asciidoctor-browser-style')
    if (a && a.href && a.href.indexOf('chrome') > -1) return true
    return false
}

function insert_ctheme_txt() {
    return insert_theme_txt(this.responseText, 'code', true)
}
function insert_theme_txt(txt, typ, sync_or_code) {
    if (!sync_or_code) {
        typ = 'adoc'
        txt = this.responseText
    } // async return for adoc
    if (typ == 'adoc' && D.TH.has_css_set) {
        function rmorigcss() {
            let a = document.getElementById('asciidoctor-browser-style')
            if (!a) {
                // not yet inserted. wait, it MUST be removed, otherwise crap on the screen:
                return setTimeout(rmorigcss, 10)
            }
            a.parentElement.removeChild(a)
        }
    }

    let t = byid('theme_sel_css' + typ)
    t && t.parentElement.removeChild(t)
    let n = get_cur_theme(typ)
    t = D.createElement('style')
    t.type = 'text/css'
    t.id = 'theme_sel_css' + typ
    D.getElementsByTagName('head')[0].appendChild(t)
    // they are remote, but this is resolved to local:
    if (typ == 'adoc') {
        let ad = '@import "asciidoctor.css";'
        if (txt.indexOf(ad) > -1) txt = txt.replace(ad, ad_css)
    }
    t.appendChild(D.createTextNode(txt))
    if (typ == 'code') return
    if (!D.axattrs.themes) return

    //postprocessing - boot styles don't support toc:left. But we want it nevertheless,
    // so hammer the stuff into it (using a big hammer):
    let ta, bg
    ta = document.querySelector('#toc a')
    if (!ta) return
    // colors and style of switcher boxes, dependend on boot or not boot theme:
    let pl = ''
    let pr = ''
    bg = window.getComputedStyle(ta, null).getPropertyValue('background-color')
    byid('adoc_switcher_dropdown').style['background-color'] = bg
    byid('code_switcher_dropdown').style['background-color'] = bg
    byid('adoc_switcher_dropdown').style['border-color'] = bg
    byid('code_switcher_dropdown').style['border-color'] = bg

    if (n.indexOf('boot-') > -1) {
        pl = '10em'
        pr = '0px'
        if (n.indexOf('boot-cerulean') > -1) bg = 'gray'
        document.querySelectorAll('pre code').forEach(function(el) {
            el.style['white-space'] = 'pre'
        })

        // make the toc be vertical for boot items, otherwise they float:
        document.querySelectorAll('#toc a').forEach(function(el) {
            el.style.float = 'none'
            el.style.padding = '2px'
        })
    }
    byid('content').style['padding-left'] = pl
    byid('content').style['padding-right'] = pr
    byid('toc').style['background-color'] = bg
    byid('code_switcher').style['background-color'] = bg
    byid('adoc_switcher').style['background-color'] = bg
    let l = ['color', 'background-color']
    for (let i = 0; i < l.length; i++) {
        bg = window
            .getComputedStyle(D.getElementsByTagName('h2')[0], null)
            .getPropertyValue(l[i])
        byid('toctitle').style[l[i]] = bg
    }
}

function set_theme(theme, typ) {
    let th = D.TH[typ]
    let isinit = theme ? false : true
    let url,
        base = SERVER_URL + th.urlpth
    if (!theme) {
        url = byid(th.ext_id)
        theme = new URLSearchParams(window.location.search).get(th.query_sel)
    }
    theme = theme ? theme : get_cur_theme(typ)
    let themes = allthemes()[typ]
    if (themes && themes.indexOf(theme) < 0) return
    if (get_cur_theme(typ) == theme && !isinit) return
    remember_cur_theme(theme, typ)
    // syncronous loading of locally stored ones?
    // naa, they are cached, loaded in 1ms says network inspector, and its a meg in total:
    // let t = S.getItem('theme_' + typ + theme)
    // if (t) {
    //     insert_theme_txt(t, typ, true)
    // } else {
    let r = new XMLHttpRequest()
    let cb = typ == 'adoc' ? insert_theme_txt : insert_ctheme_txt
    r.addEventListener('load', cb)
    r.open('GET', base + theme + '.css')
    r.send()
}

function make_css_container_elmt() {
    if (D.axattrs.tocleft) {
        // css to treat toc like toc2 - fixed:
        var css = `
        #toc {z-index:100;top:10em!; right:0em!; float:none; display:block!; position:fixed!}
        body>div#content {padding-left:1em!;}
        @media only screen and (min-width:1280px){
            #toc {width:20%!;height:100%!;left:0em!;overflow:auto;top:0em!;padding-top:2em;}
            body>div#content {width:75%!;
                              max-width:none;
                              margin:0;
                              padding-right: 5em;
                              margin-left:auto!;
                              padding-left:0em!;
                              }
            }
        @media only screen and (min-width:1500px){
            body>div#content {padding-right:10em;}
            }
        @media only screen and (min-width:1750px){
            }
        #switchers {z-index:200!;width:20%!; position:fixed; bottom: 0em; left: 0em;}
        #adoc_switcher,#code_switcher {border-width:0px!}
        `.replace(/!/gi, '!important')
        //.highlight {background-color: inherit!important; border-width: 0!important}
        head = D.getElementsByTagName('head')[0]
        style = D.createElement('style')
        head.appendChild(style)
        style.type = 'text/css'
        style.appendChild(D.createTextNode(css))
    }
}

function loaded_themes() {
    // callback after load - we poll for index set in wait_rendered:
    D.TH.index = JSON.parse(this.responseText)
    console.log('have set', D.TH.index)
}
function wait_rendered() {
    // blocking for async and rendering results:
    if (!D.TH.index || !byid('content')) {
        console.log('waiting for content and theme index')
        return setTimeout(wait_rendered, 5)
    }
    if (ext_has_css_set()) D.TH.has_css_set = true
    if (D.TH.index == 'offline') return
    D.axattrs.themes && make_theme_switchers()
    // sets stored themes:
    set_theme(false, 'adoc')
    set_theme(false, 'code')
    if (D.TH.qsappend == 'local') run_qs_append_feature()
    if (D.TH.toclogo) add_toc_logo()
    add_docs_links()
}

function add_docs_links() {
    let toc = byid('toc')
    let lis = toc.getElementsByTagName('li')
    let hr,
        lnk,
        li,
        ch = false
    for (var i = 0; i < lis.length; i++) {
        li = lis[i]
        // this is a unicode block space - use this!!
        hr = li.firstElementChild
        if (ch) {
            lnk = byid(hr.href.split('#')[1])
            hr.href = lnk.firstElementChild.href
            lnk.innerHTML = ''
        }
        if (hr.innerText && hr.innerText.endsWith('──')) {
            ch = true
        }
    }
}

function add_toc_logo() {
    let img = D.createElement('img')
    img.src = D.TH.toclogo
    byid('toc').insertBefore(img, byid('toctitle'))
}
function run_qs_append_feature() {
    // query string append feature for bitbucket's fubared revision in query strings:
    function replace_link(el, attr, thishost, thisqs) {
        orig = el[attr]
        if (orig.indexOf(thishost) != 0) return
        orig = new URL(orig)
        s = orig.search.replace('?', '')
        if (s.indexOf(thisqs) == -1) {
            el[attr] = (
                el[attr].split('?', 1)[0] +
                '?' +
                s +
                '&' +
                thisqs +
                '#' +
                orig.hash
            ).replace('&&', '&')
        }
    }
    let thishost = new URL(location.href)
    let thisqs = thishost.search.replace('?', '')
    thishost = thishost.protocol + '//' + thishost.hostname
    if (!thisqs) return
    document.querySelectorAll('a').forEach(function(el) {
        replace_link(el, 'href', thishost, thisqs)
    })
    document.querySelectorAll('img').forEach(function(el) {
        replace_link(el, 'src', thishost, thisqs)
    })
}

if (D.axattrs) {
    if (D.TH.has_css_set) {
        set_theme(false, 'adoc')
        set_theme(false, 'code')
    }
    if (D.TH.toclogo) add_toc_logo()
}

if (!D.axattrs) {
    // Initial rendering, we see the source (only) now!
    // var targetNode = document.querySelector('body')
    // var observerOptions = {
    //     childList: true,
    //     attributes: true,
    //     subtree: true, //Omit or set to false to observe only changes to the parent node.
    // }
    // function callback(ml, observer) {
    //     let c = document.getElementById('content')
    //     if (window.mutated || !c) return
    //     window.mutated = true
    //     c.firstChild.innerText = 'New Title'
    // }
    // var observer = new MutationObserver(callback)
    // observer.observe(targetNode, observerOptions)
    // theme config for adoc itself and the code:
    D.TH = {
        adoc: {
            urlpth: '/stylesheets/',
            ext_id: 'asciidoctor-browser-style',
            ddtitle: 'Theme Selector (Alt-s)',
            ddid: 'adoc_switcher_dropdown',
            ddaccesskey: 's',
            query_sel: 'theme',
        },
        code: {
            urlpth: '/highlightjs/',
            ext_id: 'asciidoctor-browser-github-highlight-style',
            ddtitle: 'Code Selector (Alt-c)',
            ddid: 'code_switcher_dropdown',
            ddaccesskey: 'c',
            query_sel: 'ctheme',
        },
        index: false, // from server
        has_css_set: false, // will be inserted again and again.
        qsappend: false,
    }

    // // var docs = docbody().innerText.split('// DOCS: ')[1]
    // if (docs) D.TH.docs = JSON.parse(docs)

    // query string append feature for bitbucket (via doc or query string, when otherwise hosted):
    D.TH.qsappend = is_set(':qsappend: local') ? 'local' : false
    if (location.href.indexOf('qsappend=local') > -1) D.TH.qsappend = 'local'

    let tocleft =
        TOC_LEFT == 'never'
            ? false
            : TOC_LEFT == ':toc: left' && is_set(':toc: left')
            ? true
            : TOC_LEFT == ':toc:' && is_set(':toc:')
            ? true
            : true
    let themes =
        THEMES == 'never' ? false : THEMES == 'always' ? true : is_set(':themes:')

    D.axattrs = {tocleft: tocleft, themes: themes}
    if (themes) {
        function offline() {
            D.TH.index = 'offline'
        }
        // make the switchers, add all available themes into them, from the server:
        let r = new XMLHttpRequest()
        r.addEventListener('load', loaded_themes)
        r.addEventListener('abort', offline)
        r.addEventListener('error', offline) // won't see those, the extension is overwriting xhr
        r.open('GET', SERVER_URL + '/index.txt')
        r.send()
    } else {
        D.TH.index = 'n.a.'
    }
    D.TH['toclogo'] = is_set(':toclogo:', true)
    make_css_container_elmt()
    //
    // many styles import this, and we pull from remote so we would not get them:
    // don't want to change the css-es for the skins
    var ad_css = String.raw`
/* Asciidoctor default stylesheet | MIT License | http://asciidoctor.org *//* Remove comment around @import statement below when using as a custom stylesheet *//*@import "https://fonts.googleapis.com/css?family=Open+Sans:300,300italic,400,400italic,600,600italic%7CNoto+Serif:400,400italic,700,700italic%7CDroid+Sans+Mono:400,700";*/article,aside,details,figcaption,figure,footer,header,hgroup,main,nav,section,summary{display:block}audio,canvas,video{display:inline-block}audio:not([controls]){display:none;height:0}[hidden],template{display:none}script{display:none!important}html{font-family:sans-serif;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}body{margin:0}a{background:transparent}a:focus{outline:thin dotted}a:active,a:hover{outline:0}h1{font-size:2em;margin:.67em 0}abbr[title]{border-bottom:1px dotted}b,strong{font-weight:bold}dfn{font-style:italic}hr{-moz-box-sizing:content-box;box-sizing:content-box;height:0}mark{background:#ff0;color:#000}code,kbd,pre,samp{font-family:monospace;font-size:1em}pre{white-space:pre-wrap}q{quotes:"\201C" "\201D" "\2018" "\2019"}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sup{top:-.5em}sub{bottom:-.25em}img{border:0}svg:not(:root){overflow:hidden}figure{margin:0}fieldset{border:1px solid silver;margin:0 2px;padding:.35em .625em .75em}legend{border:0;padding:0}button,input,select,textarea{font-family:inherit;font-size:100%;margin:0}button,input{line-height:normal}button,select{text-transform:none}button,html input[type="button"],input[type="reset"],input[type="submit"]{-webkit-appearance:button;cursor:pointer}button[disabled],html input[disabled]{cursor:default}input[type="checkbox"],input[type="radio"]{box-sizing:border-box;padding:0}input[type="search"]{-webkit-appearance:textfield;-moz-box-sizing:content-box;-webkit-box-sizing:content-box;box-sizing:content-box}input[type="search"]::-webkit-search-cancel-button,input[type="search"]::-webkit-search-decoration{-webkit-appearance:none}button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0}textarea{overflow:auto;vertical-align:top}table{border-collapse:collapse;border-spacing:0}*,*:before,*:after{-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box}html,body{font-size:100%}body{background:#fff;color:rgba(0,0,0,.8);padding:0;margin:0;font-family:"Noto Serif","DejaVu Serif",serif;font-weight:400;font-style:normal;line-height:1;position:relative;cursor:auto}a:hover{cursor:pointer}img,object,embed{max-width:100%;height:auto}object,embed{height:100%}img{-ms-interpolation-mode:bicubic}.left{float:left!important}.right{float:right!important}.text-left{text-align:left!important}.text-right{text-align:right!important}.text-center{text-align:center!important}.text-justify{text-align:justify!important}.hide{display:none}body{-webkit-font-smoothing:antialiased}img,object,svg{display:inline-block;vertical-align:middle}textarea{height:auto;min-height:50px}select{width:100%}.center{margin-left:auto;margin-right:auto}.spread{width:100%}p.lead,.paragraph.lead>p,#preamble>.sectionbody>.paragraph:first-of-type p{font-size:1.21875em;line-height:1.6}.subheader,.admonitionblock td.content>.title,.audioblock>.title,.exampleblock>.title,.imageblock>.title,.listingblock>.title,.literalblock>.title,.stemblock>.title,.openblock>.title,.paragraph>.title,.quoteblock>.title,table.tableblock>.title,.verseblock>.title,.videoblock>.title,.dlist>.title,.olist>.title,.ulist>.title,.qlist>.title,.hdlist>.title{line-height:1.45;color:#7a2518;font-weight:400;margin-top:0;margin-bottom:.25em}div,dl,dt,dd,ul,ol,li,h1,h2,h3,#toctitle,.sidebarblock>.content>.title,h4,h5,h6,pre,form,p,blockquote,th,td{margin:0;padding:0;direction:ltr}a{color:#2156a5;text-decoration:underline;line-height:inherit}a:hover,a:focus{color:#1d4b8f}a img{border:none}p{font-family:inherit;font-weight:400;font-size:1em;line-height:1.6;margin-bottom:1.25em;text-rendering:optimizeLegibility}p aside{font-size:.875em;line-height:1.35;font-style:italic}h1,h2,h3,#toctitle,.sidebarblock>.content>.title,h4,h5,h6{font-family:"Open Sans","DejaVu Sans",sans-serif;font-weight:300;font-style:normal;color:#ba3925;text-rendering:optimizeLegibility;margin-top:1em;margin-bottom:.5em;line-height:1.0125em}h1 small,h2 small,h3 small,#toctitle small,.sidebarblock>.content>.title small,h4 small,h5 small,h6 small{font-size:60%;color:#e99b8f;line-height:0}h1{font-size:2.125em}h2{font-size:1.6875em}h3,#toctitle,.sidebarblock>.content>.title{font-size:1.375em}h4,h5{font-size:1.125em}h6{font-size:1em}hr{border:solid #ddddd8;border-width:1px 0 0;clear:both;margin:1.25em 0 1.1875em;height:0}em,i{font-style:italic;line-height:inherit}strong,b{font-weight:bold;line-height:inherit}small{font-size:60%;line-height:inherit}code{font-family:"Droid Sans Mono","DejaVu Sans Mono",monospace;font-weight:400;color:rgba(0,0,0,.9)}ul,ol,dl{font-size:1em;line-height:1.6;margin-bottom:1.25em;list-style-position:outside;font-family:inherit}ul,ol,ul.no-bullet,ol.no-bullet{margin-left:1.5em}ul li ul,ul li ol{margin-left:1.25em;margin-bottom:0;font-size:1em}ul.square li ul,ul.circle li ul,ul.disc li ul{list-style:inherit}ul.square{list-style-type:square}ul.circle{list-style-type:circle}ul.disc{list-style-type:disc}ul.no-bullet{list-style:none}ol li ul,ol li ol{margin-left:1.25em;margin-bottom:0}dl dt{margin-bottom:.3125em;font-weight:bold}dl dd{margin-bottom:1.25em}abbr,acronym{text-transform:uppercase;font-size:90%;color:rgba(0,0,0,.8);border-bottom:1px dotted #ddd;cursor:help}abbr{text-transform:none}blockquote{margin:0 0 1.25em;padding:.5625em 1.25em 0 1.1875em;border-left:1px solid #ddd}blockquote cite{display:block;font-size:.9375em;color:rgba(0,0,0,.6)}blockquote cite:before{content:"\2014 \0020"}blockquote cite a,blockquote cite a:visited{color:rgba(0,0,0,.6)}blockquote,blockquote p{line-height:1.6;color:rgba(0,0,0,.85)}@media only screen and (min-width:768px){h1,h2,h3,#toctitle,.sidebarblock>.content>.title,h4,h5,h6{line-height:1.2}h1{font-size:2.75em}h2{font-size:2.3125em}h3,#toctitle,.sidebarblock>.content>.title{font-size:1.6875em}h4{font-size:1.4375em}}table{background:#fff;margin-bottom:1.25em;border:solid 1px #dedede}table thead,table tfoot{background:#f7f8f7;font-weight:bold}table thead tr th,table thead tr td,table tfoot tr th,table tfoot tr td{padding:.5em .625em .625em;font-size:inherit;color:rgba(0,0,0,.8);text-align:left}table tr th,table tr td{padding:.5625em .625em;font-size:inherit;color:rgba(0,0,0,.8)}table tr.even,table tr.alt,table tr:nth-of-type(even){background:#f8f8f7}table thead tr th,table tfoot tr th,table tbody tr td,table tr td,table tfoot tr td{display:table-cell;line-height:1.6}body{tab-size:4}h1,h2,h3,#toctitle,.sidebarblock>.content>.title,h4,h5,h6{line-height:1.2;word-spacing:-.05em}h1 strong,h2 strong,h3 strong,#toctitle strong,.sidebarblock>.content>.title strong,h4 strong,h5 strong,h6 strong{font-weight:400}.clearfix:before,.clearfix:after,.float-group:before,.float-group:after{content:" ";display:table}.clearfix:after,.float-group:after{clear:both}*:not(pre)>code{font-size:.9375em;font-style:normal!important;letter-spacing:0;padding:.1em .5ex;word-spacing:-.15em;background-color:#f7f7f8;-webkit-border-radius:4px;border-radius:4px;line-height:1.45;text-rendering:optimizeSpeed}pre,pre>code{line-height:1.45;color:rgba(0,0,0,.9);font-family:"Droid Sans Mono","DejaVu Sans Mono",monospace;font-weight:400;text-rendering:optimizeSpeed}.keyseq{color:rgba(51,51,51,.8)}kbd{font-family:"Droid Sans Mono","DejaVu Sans Mono",monospace;display:inline-block;color:rgba(0,0,0,.8);font-size:.65em;line-height:1.45;background-color:#f7f7f7;border:1px solid #ccc;-webkit-border-radius:3px;border-radius:3px;-webkit-box-shadow:0 1px 0 rgba(0,0,0,.2),0 0 0 .1em white inset;box-shadow:0 1px 0 rgba(0,0,0,.2),0 0 0 .1em #fff inset;margin:0 .15em;padding:.2em .5em;vertical-align:middle;position:relative;top:-.1em;white-space:nowrap}.keyseq kbd:first-child{margin-left:0}.keyseq kbd:last-child{margin-right:0}.menuseq,.menu{color:rgba(0,0,0,.8)}b.button:before,b.button:after{position:relative;top:-1px;font-weight:400}b.button:before{content:"[";padding:0 3px 0 2px}b.button:after{content:"]";padding:0 2px 0 3px}p a>code:hover{color:rgba(0,0,0,.9)}#header,#content,#footnotes,#footer{width:100%;margin-left:auto;margin-right:auto;margin-top:0;margin-bottom:0;max-width:62.5em;*zoom:1;position:relative;padding-left:.9375em;padding-right:.9375em}#header:before,#header:after,#content:before,#content:after,#footnotes:before,#footnotes:after,#footer:before,#footer:after{content:" ";display:table}#header:after,#content:after,#footnotes:after,#footer:after{clear:both}#content{margin-top:1.25em}#content:before{content:none}#header>h1:first-child{color:rgba(0,0,0,.85);margin-top:2.25rem;margin-bottom:0}#header>h1:first-child+#toc{margin-top:8px;border-top:1px solid #ddddd8}#header>h1:only-child,body.toc2 #header>h1:nth-last-child(2){border-bottom:1px solid #ddddd8;padding-bottom:8px}#header .details{border-bottom:1px solid #ddddd8;line-height:1.45;padding-top:.25em;padding-bottom:.25em;padding-left:.25em;color:rgba(0,0,0,.6);display:-ms-flexbox;display:-webkit-flex;display:flex;-ms-flex-flow:row wrap;-webkit-flex-flow:row wrap;flex-flow:row wrap}#header .details span:first-child{margin-left:-.125em}#header .details span.email a{color:rgba(0,0,0,.85)}#header .details br{display:none}#header .details br+span:before{content:"\00a0\2013\00a0"}#header .details br+span.author:before{content:"\00a0\22c5\00a0";color:rgba(0,0,0,.85)}#header .details br+span#revremark:before{content:"\00a0|\00a0"}#header #revnumber{text-transform:capitalize}#header #revnumber:after{content:"\00a0"}#content>h1:first-child:not([class]){color:rgba(0,0,0,.85);border-bottom:1px solid #ddddd8;padding-bottom:8px;margin-top:0;padding-top:1rem;margin-bottom:1.25rem}#toc{border-bottom:1px solid #efefed;padding-bottom:.5em}#toc>ul{margin-left:.125em}#toc ul.sectlevel0>li>a{font-style:italic}#toc ul.sectlevel0 ul.sectlevel1{margin:.5em 0}#toc ul{font-family:"Open Sans","DejaVu Sans",sans-serif;list-style-type:none}#toc li{line-height:1.3334;margin-top:.3334em}#toc a{text-decoration:none}#toc a:active{text-decoration:underline}#toctitle{color:#7a2518;font-size:1.2em}@media only screen and (min-width:768px){#toctitle{font-size:1.375em}body.toc2{padding-left:15em;padding-right:0}#toc.toc2{margin-top:0!important;background-color:#f8f8f7;position:fixed;width:15em;left:0;top:0;border-right:1px solid #efefed;border-top-width:0!important;border-bottom-width:0!important;z-index:1000;padding:1.25em 1em;height:100%;overflow:auto}#toc.toc2 #toctitle{margin-top:0;margin-bottom:.8rem;font-size:1.2em}#toc.toc2>ul{font-size:.9em;margin-bottom:0}#toc.toc2 ul ul{margin-left:0;padding-left:1em}#toc.toc2 ul.sectlevel0 ul.sectlevel1{padding-left:0;margin-top:.5em;margin-bottom:.5em}body.toc2.toc-right{padding-left:0;padding-right:15em}body.toc2.toc-right #toc.toc2{border-right-width:0;border-left:1px solid #efefed;left:auto;right:0}}@media only screen and (min-width:1280px){body.toc2{padding-left:20em;padding-right:0}#toc.toc2{width:20em}#toc.toc2 #toctitle{font-size:1.375em}#toc.toc2>ul{font-size:.95em}#toc.toc2 ul ul{padding-left:1.25em}body.toc2.toc-right{padding-left:0;padding-right:20em}}#content #toc{border-style:solid;border-width:1px;border-color:#e0e0dc;margin-bottom:1.25em;padding:1.25em;background:#f8f8f7;-webkit-border-radius:4px;border-radius:4px}#content #toc>:first-child{margin-top:0}#content #toc>:last-child{margin-bottom:0}#footer{max-width:100%;background-color:rgba(0,0,0,.8);padding:1.25em}#footer-text{color:rgba(255,255,255,.8);line-height:1.44}.sect1{padding-bottom:.625em}@media only screen and (min-width:768px){.sect1{padding-bottom:1.25em}}.sect1+.sect1{border-top:1px solid #efefed}#content h1>a.anchor,h2>a.anchor,h3>a.anchor,#toctitle>a.anchor,.sidebarblock>.content>.title>a.anchor,h4>a.anchor,h5>a.anchor,h6>a.anchor{position:absolute;z-index:1001;width:1.5ex;margin-left:-1.5ex;display:block;text-decoration:none!important;visibility:hidden;text-align:center;font-weight:400}#content h1>a.anchor:before,h2>a.anchor:before,h3>a.anchor:before,#toctitle>a.anchor:before,.sidebarblock>.content>.title>a.anchor:before,h4>a.anchor:before,h5>a.anchor:before,h6>a.anchor:before{content:"\00A7";font-size:.85em;display:block;padding-top:.1em}#content h1:hover>a.anchor,#content h1>a.anchor:hover,h2:hover>a.anchor,h2>a.anchor:hover,h3:hover>a.anchor,#toctitle:hover>a.anchor,.sidebarblock>.content>.title:hover>a.anchor,h3>a.anchor:hover,#toctitle>a.anchor:hover,.sidebarblock>.content>.title>a.anchor:hover,h4:hover>a.anchor,h4>a.anchor:hover,h5:hover>a.anchor,h5>a.anchor:hover,h6:hover>a.anchor,h6>a.anchor:hover{visibility:visible}#content h1>a.link,h2>a.link,h3>a.link,#toctitle>a.link,.sidebarblock>.content>.title>a.link,h4>a.link,h5>a.link,h6>a.link{color:#ba3925;text-decoration:none}#content h1>a.link:hover,h2>a.link:hover,h3>a.link:hover,#toctitle>a.link:hover,.sidebarblock>.content>.title>a.link:hover,h4>a.link:hover,h5>a.link:hover,h6>a.link:hover{color:#a53221}.audioblock,.imageblock,.literalblock,.listingblock,.stemblock,.videoblock{margin-bottom:1.25em}.admonitionblock td.content>.title,.audioblock>.title,.exampleblock>.title,.imageblock>.title,.listingblock>.title,.literalblock>.title,.stemblock>.title,.openblock>.title,.paragraph>.title,.quoteblock>.title,table.tableblock>.title,.verseblock>.title,.videoblock>.title,.dlist>.title,.olist>.title,.ulist>.title,.qlist>.title,.hdlist>.title{text-rendering:optimizeLegibility;text-align:left;font-family:"Noto Serif","DejaVu Serif",serif;font-size:1rem;font-style:italic}table.tableblock>caption.title{white-space:nowrap;overflow:visible;max-width:0}.paragraph.lead>p,#preamble>.sectionbody>.paragraph:first-of-type p{color:rgba(0,0,0,.85)}table.tableblock #preamble>.sectionbody>.paragraph:first-of-type p{font-size:inherit}.admonitionblock>table{border-collapse:separate;border:0;background:none;width:100%}.admonitionblock>table td.icon{text-align:center;width:80px}.admonitionblock>table td.icon img{max-width:none}.admonitionblock>table td.icon .title{font-weight:bold;font-family:"Open Sans","DejaVu Sans",sans-serif;text-transform:uppercase}.admonitionblock>table td.content{padding-left:1.125em;padding-right:1.25em;border-left:1px solid #ddddd8;color:rgba(0,0,0,.6)}.admonitionblock>table td.content>:last-child>:last-child{margin-bottom:0}.exampleblock>.content{border-style:solid;border-width:1px;border-color:#e6e6e6;margin-bottom:1.25em;padding:1.25em;background:#fff;-webkit-border-radius:4px;border-radius:4px}.exampleblock>.content>:first-child{margin-top:0}.exampleblock>.content>:last-child{margin-bottom:0}.sidebarblock{border-style:solid;border-width:1px;border-color:#e0e0dc;margin-bottom:1.25em;padding:1.25em;background:#f8f8f7;-webkit-border-radius:4px;border-radius:4px}.sidebarblock>:first-child{margin-top:0}.sidebarblock>:last-child{margin-bottom:0}.sidebarblock>.content>.title{color:#7a2518;margin-top:0;text-align:center}.exampleblock>.content>:last-child>:last-child,.exampleblock>.content .olist>ol>li:last-child>:last-child,.exampleblock>.content .ulist>ul>li:last-child>:last-child,.exampleblock>.content .qlist>ol>li:last-child>:last-child,.sidebarblock>.content>:last-child>:last-child,.sidebarblock>.content .olist>ol>li:last-child>:last-child,.sidebarblock>.content .ulist>ul>li:last-child>:last-child,.sidebarblock>.content .qlist>ol>li:last-child>:last-child{margin-bottom:0}.literalblock pre,.listingblock pre:not(.highlight),.listingblock pre[class="highlight"],.listingblock pre[class^="highlight "],.listingblock pre.CodeRay,.listingblock pre.prettyprint{background:#f7f7f8}.sidebarblock .literalblock pre,.sidebarblock .listingblock pre:not(.highlight),.sidebarblock .listingblock pre[class="highlight"],.sidebarblock .listingblock pre[class^="highlight "],.sidebarblock .listingblock pre.CodeRay,.sidebarblock .listingblock pre.prettyprint{background:#f2f1f1}.literalblock pre,.literalblock pre[class],.listingblock pre,.listingblock pre[class]{-webkit-border-radius:4px;border-radius:4px;word-wrap:break-word;padding:1em;font-size:.8125em}.literalblock pre.nowrap,.literalblock pre[class].nowrap,.listingblock pre.nowrap,.listingblock pre[class].nowrap{overflow-x:auto;white-space:pre;word-wrap:normal}@media only screen and (min-width:768px){.literalblock pre,.literalblock pre[class],.listingblock pre,.listingblock pre[class]{font-size:.90625em}}@media only screen and (min-width:1280px){.literalblock pre,.literalblock pre[class],.listingblock pre,.listingblock pre[class]{font-size:1em}}.literalblock.output pre{color:#f7f7f8;background-color:rgba(0,0,0,.9)}.listingblock pre.highlightjs{padding:0}.listingblock pre.highlightjs>code{padding:1em;-webkit-border-radius:4px;border-radius:4px}.listingblock pre.prettyprint{border-width:0}.listingblock>.content{position:relative}.listingblock code[data-lang]:before{display:none;content:attr(data-lang);position:absolute;font-size:.75em;top:.425rem;right:.5rem;line-height:1;text-transform:uppercase;color:#999}.listingblock:hover code[data-lang]:before{display:block}.listingblock.terminal pre .command:before{content:attr(data-prompt);padding-right:.5em;color:#999}.listingblock.terminal pre .command:not([data-prompt]):before{content:"$"}table.pyhltable{border-collapse:separate;border:0;margin-bottom:0;background:none}table.pyhltable td{vertical-align:top;padding-top:0;padding-bottom:0;line-height:1.45}table.pyhltable td.code{padding-left:.75em;padding-right:0}pre.pygments .lineno,table.pyhltable td:not(.code){color:#999;padding-left:0;padding-right:.5em;border-right:1px solid #ddddd8}pre.pygments .lineno{display:inline-block;margin-right:.25em}table.pyhltable .linenodiv{background:none!important;padding-right:0!important}.quoteblock{margin:0 1em 1.25em 1.5em;display:table}.quoteblock>.title{margin-left:-1.5em;margin-bottom:.75em}.quoteblock blockquote,.quoteblock blockquote p{color:rgba(0,0,0,.85);font-size:1.15rem;line-height:1.75;word-spacing:.1em;letter-spacing:0;font-style:italic;text-align:justify}.quoteblock blockquote{margin:0;padding:0;border:0}.quoteblock blockquote:before{content:"\201c";float:left;font-size:2.75em;font-weight:bold;line-height:.6em;margin-left:-.6em;color:#7a2518;text-shadow:0 1px 2px rgba(0,0,0,.1)}.quoteblock blockquote>.paragraph:last-child p{margin-bottom:0}.quoteblock .attribution{margin-top:.5em;margin-right:.5ex;text-align:right}.quoteblock .quoteblock{margin-left:0;margin-right:0;padding:.5em 0;border-left:3px solid rgba(0,0,0,.6)}.quoteblock .quoteblock blockquote{padding:0 0 0 .75em}.quoteblock .quoteblock blockquote:before{display:none}.verseblock{margin:0 1em 1.25em 1em}.verseblock pre{font-family:"Open Sans","DejaVu Sans",sans;font-size:1.15rem;color:rgba(0,0,0,.85);font-weight:300;text-rendering:optimizeLegibility}.verseblock pre strong{font-weight:400}.verseblock .attribution{margin-top:1.25rem;margin-left:.5ex}.quoteblock .attribution,.verseblock .attribution{font-size:.9375em;line-height:1.45;font-style:italic}.quoteblock .attribution br,.verseblock .attribution br{display:none}.quoteblock .attribution cite,.verseblock .attribution cite{display:block;letter-spacing:-.025em;color:rgba(0,0,0,.6)}.quoteblock.abstract{margin:0 0 1.25em 0;display:block}.quoteblock.abstract blockquote,.quoteblock.abstract blockquote p{text-align:left;word-spacing:0}.quoteblock.abstract blockquote:before,.quoteblock.abstract blockquote p:first-of-type:before{display:none}table.tableblock{max-width:100%;border-collapse:separate}table.tableblock td>.paragraph:last-child p>p:last-child,table.tableblock th>p:last-child,table.tableblock td>p:last-child{margin-bottom:0}table.tableblock,th.tableblock,td.tableblock{border:0 solid #dedede}table.grid-all th.tableblock,table.grid-all td.tableblock{border-width:0 1px 1px 0}table.grid-all tfoot>tr>th.tableblock,table.grid-all tfoot>tr>td.tableblock{border-width:1px 1px 0 0}table.grid-cols th.tableblock,table.grid-cols td.tableblock{border-width:0 1px 0 0}table.grid-all *>tr>.tableblock:last-child,table.grid-cols *>tr>.tableblock:last-child{border-right-width:0}table.grid-rows th.tableblock,table.grid-rows td.tableblock{border-width:0 0 1px 0}table.grid-all tbody>tr:last-child>th.tableblock,table.grid-all tbody>tr:last-child>td.tableblock,table.grid-all thead:last-child>tr>th.tableblock,table.grid-rows tbody>tr:last-child>th.tableblock,table.grid-rows tbody>tr:last-child>td.tableblock,table.grid-rows thead:last-child>tr>th.tableblock{border-bottom-width:0}table.grid-rows tfoot>tr>th.tableblock,table.grid-rows tfoot>tr>td.tableblock{border-width:1px 0 0 0}table.frame-all{border-width:1px}table.frame-sides{border-width:0 1px}table.frame-topbot{border-width:1px 0}th.halign-left,td.halign-left{text-align:left}th.halign-right,td.halign-right{text-align:right}th.halign-center,td.halign-center{text-align:center}th.valign-top,td.valign-top{vertical-align:top}th.valign-bottom,td.valign-bottom{vertical-align:bottom}th.valign-middle,td.valign-middle{vertical-align:middle}table thead th,table tfoot th{font-weight:bold}tbody tr th{display:table-cell;line-height:1.6;background:#f7f8f7}tbody tr th,tbody tr th p,tfoot tr th,tfoot tr th p{color:rgba(0,0,0,.8);font-weight:bold}p.tableblock>code:only-child{background:none;padding:0}p.tableblock{font-size:1em}td>div.verse{white-space:pre}ol{margin-left:1.75em}ul li ol{margin-left:1.5em}dl dd{margin-left:1.125em}dl dd:last-child,dl dd:last-child>:last-child{margin-bottom:0}ol>li p,ul>li p,ul dd,ol dd,.olist .olist,.ulist .ulist,.ulist .olist,.olist .ulist{margin-bottom:.625em}ul.unstyled,ol.unnumbered,ul.checklist,ul.none{list-style-type:none}ul.unstyled,ol.unnumbered,ul.checklist{margin-left:.625em}ul.checklist li>p:first-child>.fa-square-o:first-child,ul.checklist li>p:first-child>.fa-check-square-o:first-child{width:1em;font-size:.85em}ul.checklist li>p:first-child>input[type="checkbox"]:first-child{width:1em;position:relative;top:1px}ul.inline{margin:0 auto .625em auto;margin-left:-1.375em;margin-right:0;padding:0;list-style:none;overflow:hidden}ul.inline>li{list-style:none;float:left;margin-left:1.375em;display:block}ul.inline>li>*{display:block}.unstyled dl dt{font-weight:400;font-style:normal}ol.arabic{list-style-type:decimal}ol.decimal{list-style-type:decimal-leading-zero}ol.loweralpha{list-style-type:lower-alpha}ol.upperalpha{list-style-type:upper-alpha}ol.lowerroman{list-style-type:lower-roman}ol.upperroman{list-style-type:upper-roman}ol.lowergreek{list-style-type:lower-greek}.hdlist>table,.colist>table{border:0;background:none}.hdlist>table>tbody>tr,.colist>table>tbody>tr{background:none}td.hdlist1,td.hdlist2{vertical-align:top;padding:0 .625em}td.hdlist1{font-weight:bold;padding-bottom:1.25em}.literalblock+.colist,.listingblock+.colist{margin-top:-.5em}.colist>table tr>td:first-of-type{padding:0 .75em;line-height:1}.colist>table tr>td:last-of-type{padding:.25em 0}.thumb,.th{line-height:0;display:inline-block;border:solid 4px #fff;-webkit-box-shadow:0 0 0 1px #ddd;box-shadow:0 0 0 1px #ddd}.imageblock.left,.imageblock[style*="float: left"]{margin:.25em .625em 1.25em 0}.imageblock.right,.imageblock[style*="float: right"]{margin:.25em 0 1.25em .625em}.imageblock>.title{margin-bottom:0}.imageblock.thumb,.imageblock.th{border-width:6px}.imageblock.thumb>.title,.imageblock.th>.title{padding:0 .125em}.image.left,.image.right{margin-top:.25em;margin-bottom:.25em;display:inline-block;line-height:0}.image.left{margin-right:.625em}.image.right{margin-left:.625em}a.image{text-decoration:none;display:inline-block}a.image object{pointer-events:none}sup.footnote,sup.footnoteref{font-size:.875em;position:static;vertical-align:super}sup.footnote a,sup.footnoteref a{text-decoration:none}sup.footnote a:active,sup.footnoteref a:active{text-decoration:underline}#footnotes{padding-top:.75em;padding-bottom:.75em;margin-bottom:.625em}#footnotes hr{width:20%;min-width:6.25em;margin:-.25em 0 .75em 0;border-width:1px 0 0 0}#footnotes .footnote{padding:0 .375em 0 .225em;line-height:1.3334;font-size:.875em;margin-left:1.2em;text-indent:-1.05em;margin-bottom:.2em}#footnotes .footnote a:first-of-type{font-weight:bold;text-decoration:none}#footnotes .footnote:last-of-type{margin-bottom:0}#content #footnotes{margin-top:-.625em;margin-bottom:0;padding:.75em 0}.gist .file-data>table{border:0;background:#fff;width:100%;margin-bottom:0}.gist .file-data>table td.line-data{width:99%}div.unbreakable{page-break-inside:avoid}.big{font-size:larger}.small{font-size:smaller}.underline{text-decoration:underline}.overline{text-decoration:overline}.line-through{text-decoration:line-through}.aqua{color:#00bfbf}.aqua-background{background-color:#00fafa}.black{color:#000}.black-background{background-color:#000}.blue{color:#0000bf}.blue-background{background-color:#0000fa}.fuchsia{color:#bf00bf}.fuchsia-background{background-color:#fa00fa}.gray{color:#606060}.gray-background{background-color:#7d7d7d}.green{color:#006000}.green-background{background-color:#007d00}.lime{color:#00bf00}.lime-background{background-color:#00fa00}.maroon{color:#600000}.maroon-background{background-color:#7d0000}.navy{color:#000060}.navy-background{background-color:#00007d}.olive{color:#606000}.olive-background{background-color:#7d7d00}.purple{color:#600060}.purple-background{background-color:#7d007d}.red{color:#bf0000}.red-background{background-color:#fa0000}.silver{color:#909090}.silver-background{background-color:#bcbcbc}.teal{color:#006060}.teal-background{background-color:#007d7d}.white{color:#bfbfbf}.white-background{background-color:#fafafa}.yellow{color:#bfbf00}.yellow-background{background-color:#fafa00}span.icon>.fa{cursor:default}.admonitionblock td.icon [class^="fa icon-"]{font-size:2.5em;text-shadow:1px 1px 2px rgba(0,0,0,.5);cursor:default}.admonitionblock td.icon .icon-note:before{content:"\f05a";color:#19407c}.admonitionblock td.icon .icon-tip:before{content:"\f0eb";text-shadow:1px 1px 2px rgba(155,155,0,.8);color:#111}.admonitionblock td.icon .icon-warning:before{content:"\f071";color:#bf6900}.admonitionblock td.icon .icon-caution:before{content:"\f06d";color:#bf3400}.admonitionblock td.icon .icon-important:before{content:"\f06a";color:#bf0000}.conum[data-value]{display:inline-block;color:#fff!important;background-color:rgba(0,0,0,.8);-webkit-border-radius:100px;border-radius:100px;text-align:center;font-size:.75em;width:1.67em;height:1.67em;line-height:1.67em;font-family:"Open Sans","DejaVu Sans",sans-serif;font-style:normal;font-weight:bold}.conum[data-value] *{color:#fff!important}.conum[data-value]+b{display:none}.conum[data-value]:after{content:attr(data-value)}pre .conum[data-value]{position:relative;top:-.125em}b.conum *{color:inherit!important}.conum:not([data-value]):empty{display:none}dt,th.tableblock,td.content,div.footnote{text-rendering:optimizeLegibility}h1,h2,p,td.content,span.alt{letter-spacing:-.01em}p strong,td.content strong,div.footnote strong{letter-spacing:-.005em}p,blockquote,dt,td.content,span.alt{font-size:1.0625rem}p{margin-bottom:1.25rem}.sidebarblock p,.sidebarblock dt,.sidebarblock td.content,p.tableblock{font-size:1em}.exampleblock>.content{background-color:#fffef7;border-color:#e0e0dc;-webkit-box-shadow:0 1px 4px #e0e0dc;box-shadow:0 1px 4px #e0e0dc}.print-only{display:none!important}@media print{@page{margin:1.25cm .75cm}*{-webkit-box-shadow:none!important;box-shadow:none!important;text-shadow:none!important}a{color:inherit!important;text-decoration:underline!important}a.bare,a[href^="#"],a[href^="mailto:"]{text-decoration:none!important}a[href^="http:"]:not(.bare):after,a[href^="https:"]:not(.bare):after{content:"(" attr(href) ")";display:inline-block;font-size:.875em;padding-left:.25em}abbr[title]:after{content:" (" attr(title) ")"}pre,blockquote,tr,img,object,svg{page-break-inside:avoid}thead{display:table-header-group}svg{max-width:100%}p,blockquote,dt,td.content{font-size:1em;orphans:3;widows:3}h2,h3,#toctitle,.sidebarblock>.content>.title{page-break-after:avoid}#toc,.sidebarblock,.exampleblock>.content{background:none!important}#toc{border-bottom:1px solid #ddddd8!important;padding-bottom:0!important}.sect1{padding-bottom:0!important}.sect1+.sect1{border:0!important}#header>h1:first-child{margin-top:1.25rem}body.book #header{text-align:center}body.book #header>h1:first-child{border:0!important;margin:2.5em 0 1em 0}body.book #header .details{border:0!important;display:block;padding:0!important}body.book #header .details span:first-child{margin-left:0!important}body.book #header .details br{display:block}body.book #header .details br+span:before{content:none!important}body.book #toc{border:0!important;text-align:left!important;padding:0!important;margin:0!important}body.book #toc,body.book #preamble,body.book h1.sect0,body.book .sect1>h2{page-break-before:always}.listingblock code[data-lang]:before{display:block}#footer{background:none!important;padding:0 .9375em}#footer-text{color:rgba(0,0,0,.6)!important;font-size:.9em}.hide-on-print{display:none!important}.print-only{display:block!important}.hide-for-print{display:none!important}.show-for-print{display:inherit!important}}
`
    wait_rendered()
}
