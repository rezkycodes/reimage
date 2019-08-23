class BFile {
    constructor(file, n) {
        const dot_index = file.name.lastIndexOf('.');
        this.file = file;
        this.n = n;
        this.size = file.size;
        this.base_name = file.name.substr(0, dot_index);
        this.extension = file.name.substr(dot_index + 1);
        this.fx = this.fy = 0.5;
        this.is_custom_focal = false;
    }
    auto_focal() {
        smartcrop.crop(this.image, {
            width: Math.min(this.width, this.height),
            height: Math.min(this.width, this.height)
        }).then(result => {
            this.fx = result.topCrop.x / this.width;
            this.fy = result.topCrop.y / this.height;
        });
    }
    read(callback) {
        loadImage(this.file, (image, meta) => {
            this.image = image;
            this.width = image.width;
            this.height = image.height;
            this.auto_focal();
            callback(image.toDataURL());
        }, {
            orientation: true,
            maxWidth: 400
        });
    }

    get filename() {
        let fn = this.base_name + '.';
        if (this.extension.toLowerCase() == 'png' && config.convert_to_jpeg) {
            fn += 'jpg';
        } else {
            fn += this.extension
        }
        return fn;
    }

    get truncated_filename() {
        let filename = this.base_name;
        if (this.base_name.length > 20) {
            filename = this.base_name.substr(0, 15) + '..' + this.base_name.substr(this.base_name.length - 5);
        }
        return filename + '.' + this.extension;
    }

    get is_supported() {
        return ['jpg', 'jpeg', 'png'].indexOf(this.extension.toLowerCase()) > -1
    }

    get focal_x() {
        if (this.is_custom_focal || config.auto_focal) {
            return this.fx;
        } else {
            return parseFloat(config.focal_x);
        }
    }

    get focal_y() {
        if (this.is_custom_focal || config.auto_focal) {
            return this.fy;
        } else {
            return parseFloat(config.focal_y);
        }
    }
}
const default_parameters = {
    target_width: 1200,
    target_height: 1200,
    auto_width: false,
    auto_height: false,
    focal_x: 0.5,
    focal_y: 0.5,
    auto_focal: true,
    auto_save: false,
    convert_to_jpeg: false,
    quality: 80,
    rename: '',
    rename_start:0,
    border_width: 0,
    border_color: '#000'
};

class BConfig {
    constructor() {
        this.load();
    }

    load(reset = false) {
        let query_params = {};
        let url = document.location.href;
        let parts = url.substr(url.lastIndexOf('?') + 1).split('&');

        for (let p of parts) {
            if (p.indexOf('=') == -1) {
                continue;
            }
            let _tempt = p.split('=');
            query_params[_tempt[0]] = this.clean_value(_tempt[1]);
        }
        if (!reset) {
            let old_url = localStorage.getItem('url');

            if ($.isEmptyObject(query_params) && old_url) {
                history.replaceState(null, null, old_url);
                this.load(reset);
                return;
            }
        }

        for (let k in default_parameters) {
            let v = default_parameters[k];
            if (query_params.hasOwnProperty(k) && !reset) {
                v = query_params[k];
            }
            this[k] = v;
            let ele = $('#' + k);
            if (!ele.length) {
                continue;
            }
            switch (ele.attr('type').toLowerCase()) {
                case 'checkbox':
                    ele.prop('checked', v);
                    break;
                case 'number':
                    ele.val(parseInt(v));
                    break;
                default:
                    ele.val(v);
            }
        }

        this.toggle_crop_focal();
        this.update_focal();

        this.toggle_auto_wh('auto_width', 'auto_height');
        this.toggle_auto_wh('auto_height', 'auto_width');

        if (reset) {
            rezky.update_preview_all();
        }
    }

    update(ele) {
        const name = ele.id;
        let value;
        if (ele.type == 'checkbox') {
            value = $(ele).prop('checked');
        } else {
            value = ele.value;
        }
        this[name] = value;

        if (name == 'auto_width') {
            this.toggle_auto_wh('auto_width', 'auto_height');
        } else if (name == 'auto_height') {
            this.toggle_auto_wh('auto_height', 'auto_width');
        }
        this.toggle_crop_focal();
        rezky.update_preview_all();
        this.update_url();
    }

    toggle_auto_wh(key, other_key) {
        let input = $('#target' + key.substr(4));

        if (this[key]) {
            input.attr('disabled', 'disabled');
        } else {
            input.removeAttr('disabled');
        }
        if (this[key] && this[other_key]) {
            $('#' + other_key).trigger('click');
        }

        if (this.auto_width || this.auto_height) {
            $('body').addClass('auto-size');
        } else {
            $('body').removeClass('auto-size');
        }
    }

    toggle_crop_focal() {
        if (this.auto_width || this.auto_height) {
            $('.crop-auto, .crop-align').addClass('d-none');
        } else {
            $('.crop-auto').removeClass('d-none');
            if (this.auto_focal) {
                $('.crop-align').addClass('d-none');
            } else {
                $('.crop-align').removeClass('d-none');
            }
        }
    }

    toggle_convert_to_jpeg() {
        for (let f of rezky.files) {
            if (f.extension == 'png') {
                $('.convert-to-jpeg').removeClass('d-none');
                break;
            } else {
                $('.convert-to-jpeg').addClass('d-none');
            }
        }
    }

    update_focal() {
        let n = this.focal_x / 0.5 + this.focal_y / 0.5 * 3 + 1;
        const indicator = $('.anchor-points div:last-child');
        const anchor = $(`.anchor-points div:nth-child(${n})`);
        indicator.css({ top: anchor.css('top'), left: anchor.css('left') });
    }


    set_focal(ele) {
        ele = $(ele);
        const n = parseInt(ele.attr('data-n'));
        if (n == 9) {
            return;
        }
        this.focal_x = n % 3 * 0.5;
        this.focal_y = Math.floor(n / 3) * 0.5;
        const indicator = $('.anchor-points div:last-child');
        indicator.css({ top: ele.css('top'), left: ele.css('left') });
        rezky.update_preview_all();
        this.update_url();
    }


    toggle_panel(ele) {
        $('.panel.show .options-holder').slideUp(300);
        $('.panel.show').removeClass('show');

        $(ele).parent().addClass('show');
        $(ele).next().slideDown(300);
    }

    clean_value(v) {
        v = decodeURIComponent(v);
        if (v.toLowerCase() == 'true' || v.toLowerCase() == 'false') {
            return v == 'true';
        } else {
            return v;
        }
    }

    update_url() {
        let params = [];
        for (let k in default_parameters) {
            let v = this[k];
            if (v != default_parameters[k]) {
                params.push(k + '=' + encodeURIComponent(v));
            }
        }
        history.replaceState(null, null, '?' + params.join('&'));
        localStorage.setItem('url', document.location.search);
    }

}


class Rezky {
    constructor() {
        this.files = [];
        this.files_to_add = [];
        this.generated = 0;
        this.zip = new JSZip();
        this.output_zip = false;
        this.file_counter = 0;
        /**
         Initialize drag and drop
         */
        let drop_area = document.querySelector('body');
        drop_area.addEventListener('drop', e => {
            e.stopPropagation();
            e.preventDefault();
            this.add_files(e);
        });

        drop_area.addEventListener('dragover', e => {
            e.stopPropagation();
            e.preventDefault();
        });
        drop_area.addEventListener('dragenter', e => {
            e.stopPropagation();
            e.preventDefault();
        });
        this.masonry = new Masonry('.tiles-holder', {
            transitionDuration: 0
        });
        window.addEventListener('resize', e => this.resize());
        $(window).on('mouseup', this.image_mouseup);
        this.selected_holder = null;
    }

    add_files(e) {
        this.files_to_add = [];
        let _files = e['dataTransfer'] ? e.dataTransfer.files : e.target.files;
        for (let i = 0; i < _files.length; i++) {
            let f = new BFile(_files[i], this.files.length);
            if (f.is_supported) {
                this.files.push(f);
                this.files_to_add.push(f);
            }
        }
        config.toggle_convert_to_jpeg();
        $('body').addClass('not-empty');
        this.add_file();
    }


    add_file() {
        let f = this.files_to_add.shift();
        if (!f) {
            setTimeout(() => {
                this.update_preview_all();
            }, 100);
            return;
        }
        f.read(content => {
            let ele = `<div class="tile">
                        <div class="image-holder">
                        <div class="btn-delete">x</div>
                        <img src="${content}"/>
                        <div class="mask mask-1"></div>
                        <div class="mask mask-2"></div>
                        <div class="img-border"></div>
                        </div>
                        <p>${f.truncated_filename}</p>
                        </div>`;
            $('.tiles-holder').append(ele);
            let dom_ele = document.querySelector(`.tile:last-child`);
            this.masonry.appended(dom_ele);
            this.masonry.layout();
            let holder = $('.tile:last-child .image-holder');
            holder.data('file', f);
            holder.on('mousedown', this.image_mousedown);
            holder.find('.btn-delete').on('click', this.remove_file);
            this.add_file();
        });
    }

    image_mousedown(event) {

        let holder = $(event.originalEvent.target);
        if (!holder.hasClass('image-holder')) {
            holder = holder.closest('.image-holder');
        }
        let file = holder.data('file');
        holder.data('x', event.clientX);
        holder.data('y', event.clientY);

        holder.data('fx', file.focal_x);
        holder.data('fy', file.focal_y);
        rezky.selected_holder = holder;
        $(document).off('mousemove');
        $(document).on('mousemove', rezky.image_mousemove);

    }

    image_mouseup(event) {
        $(document).off('mousemove');
    }

    image_mousemove(event) {
        let holder = rezky.selected_holder;
        let file = holder.data('file');

        let x = event.clientX;
        let y = event.clientY;
        let ox = holder.data('x');
        let oy = holder.data('y');

        let fx = holder.data('fx');
        let fy = holder.data('fy');

        let new_fx = fx + (x - ox) / holder.width() * 2;
        let new_fy = fy + (y - oy) / holder.height() * 2;

        new_fx = Math.max(0, Math.min(1, new_fx));
        new_fy = Math.max(0, Math.min(1, new_fy));

        file.fx = new_fx;
        file.fy = new_fy;
        file.is_custom_focal = true;

        if (new_fx != fx || new_fy != fy) {
            rezky.update_preview_single(holder.get(0), file);
        }
    }

    remove_file(event) {
        let holder = $(event.target).closest('.image-holder');
        for (let i = 0; i < rezky.files.length; i++) {
            if (rezky.files[i] == holder.data('file')) {
                rezky.files.splice(i, 1);
                break;
            }
        }
        rezky.masonry.remove(holder.parent().get(0));
        $(holder).parent().detach();
        if (rezky.files.length == 0) {
            $('body').removeClass('not-empty');
        } else {
            rezky.masonry.layout();
        }
    }


    clear_files() {
        document.location.reload();
    }

    save(e, output_zip) {
        $('.modal').addClass('modal_show');
        this.output_zip = output_zip;
        if (this.files.length == 1) {
            this.output_zip = false;
        }
        this.zip = new JSZip();
        this.files_to_save = this.files.slice(0);
        this.save_one();
    }

    save_one() {
        if (this.files_to_save.length == 0) {
            return;
        }
        let f = this.files_to_save.shift();
        loadImage(f.file, img => this.process_image(img, f), {
            orientation: true
        });
    }

    process_image(img, file) {
        let tw = config.target_width;
        let th = config.target_height;

        const fx = file.focal_x;
        const fy = file.focal_y;

        const iw = img.width;
        const ih = img.height;

        if (config.auto_width) {
            tw = iw * th / ih;
        } else if (config.auto_height) {
            th = ih * tw / iw;
        }

        let canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        let con = canvas.getContext('2d');
        con.imageSmoothingQuality = "high";
        let scale = Math.min(iw / tw, ih / th);
        let srcw = tw * scale;
        let srch = th * scale;

        let format = 'image/jpeg';
        if (file.extension.toLowerCase() == 'png') {

            if (config.convert_to_jpeg != true) {
                format = 'image/png';
            } else {
                /*******************************************
                 * Set backgroun color to white for png
                 ******************************************/
                con.fillStyle = 'white';
                con.fillRect(0, 0, tw, th);
            }
        }
        /*******************************************
         * Border
         ******************************************/
        let hw = 0;
        if (config.border_width > 0) {
            con.lineWidth = config.border_width;
            con.strokeStyle = config.border_color;
            hw = config.border_width / 2;
            con.strokeRect(hw, hw, tw - hw * 2, th - hw * 2);
        }
        /*******************************************
         * Image after the border
         ******************************************/
        con.drawImage(img, (iw - srcw) * fx, (ih - srch) * fy, srcw, srch, hw, hw, tw - hw * 2, th - hw * 2);
        let new_filename = file.filename;
        if (config.rename) {
            let filename = config.rename.toLowerCase();
            var pattern = new RegExp('x{2,}');
            var result = pattern.exec(filename);
            if (!result) {
                pattern = new RegExp('x+');
                result = pattern.exec(filename);
            }
            if (!result) {
                alert('Sorry the filename pattern cannot be recognized.\nPlease try something like "image-xxx".');
                return;
            }
            let front = filename.substr(0, result.index);
            let end = filename.substr(result.index + result[0].length);
            let index = config.rename_start + ''
            config.rename_start++
            new_filename = front + index.padStart(result[0].length, '0') + end;
            new_filename = new_filename.replace(/(\.je?pg)|(\.png)/i, '');
            if (config.convert_to_jpeg) {
                new_filename += '.jpg';
            } else {
                new_filename += '.' + file.extension;
            }
            config.update_url();
            $('#rename_start').val(config.rename_start);
        }
        if (this.output_zip) {
            canvas.toBlob(b => this.save_zip(b, new_filename), format, config.quality / 100);
        } else {
            canvas.toBlob(b => {
                saveAs(b, new_filename);
                this.save_one();
            }, format, config.quality / 100);
        }

    }

    save_zip(b, filename) {
        this.zip.file(filename, b, {
            base64: true
        });
        if (this.files_to_save.length == 0) {
            this.zip.generateAsync({
                type: "blob"
            }).then(content => saveAs(content, "rezky.zip"));
            $('.modal').removeClass('modal_show');
        } else {
            this.save_one();
        }
    }

    update_preview_all() {
        this.masonry.layout();

        if (config.auto_width || config.auto_height) {
            return;
        }
        let holders = document.querySelectorAll('.image-holder');
        for (let i = 0; i < holders.length; i++) {
            this.update_preview_single(holders[i], this.files[i]);
        }
    }

    update_preview_single(holder, file) {
        const tw = config.target_width;
        const th = config.target_height;

        const fx = file.focal_x;
        const fy = file.focal_y;

        const w = holder.offsetWidth;
        const h = holder.offsetHeight;

        const m1 = holder.querySelector('.mask-1');
        const m2 = holder.querySelector('.mask-2');
        const border = holder.querySelector('.img-border');

        let ratio;
        if (config.auto_width) {
            ratio = h / th;
        } else if (config.auto_height) {
            ratio = w / tw;
        } else {
            ratio = Math.min(w / tw, h / th);
        }
        const nw = tw * ratio;
        const nh = th * ratio;

        let mw1 = Math.round((w - nw) * fx);
        let mh1 = Math.round((h - nh) * fy);

        let mw2 = Math.round((w - nw) * (1 - fx));
        let mh2 = Math.round((h - nh) * (1 - fy));

        let bw = w - mw1 - mw2;
        let bh = h - mh1 - mh2;
        let bt = mh1;
        let bl = mw1;
        if (Math.abs(nh - h) < 0.01) {
            bh = h;
            bt = 0;
            mh1 = mh2 = h;
        } else {
            bw = w;
            bl = 0;
            mw1 = mw2 = w;
        }
        $(m1).css({
            width: mw1,
            height: mh1
        });
        $(m2).css({
            width: mw2,
            height: mh2,
            top: h - mh2
        });
        let border_width = config.border_width;
        if (border_width > 5) {
            border_width = Math.max(2, Math.round(border_width * w / file.width));
        }
        $(border).css({
            width: bw,
            height: bh,
            top: bt,
            left: bl,
            border: `solid ${border_width}px ${config.border_color}`
        });

    }

    home() {
        this.show_section('main');
    }

    resize() {
        this.update_preview_all();
    }

    show_section(section, jump = false) {
        let ty = $('.section-' + section).offset().top - $('nav').height() - 13;
        if (jump) {
            $('html,body').scrollTop(ty);
        } else {
            $('html,body').animate({
                scrollTop: ty
            });
        }
    }

    _get_holder_index(holder) {
        let holders = $('.image-holder');
        for (let i = 0; i < holders.length; i++) {
            if (holders[i] == holder) {
                return i;
            }
        }
        return -1;
    }
}

let rezky = new Rezky();
let config = new BConfig();
// rezky.show_section('about',true);