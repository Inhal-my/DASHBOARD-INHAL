<?php

namespace App\Controllers;

use App\Libraries\AuthService;

class Logout extends BaseController
{
    public function index()
    {
        (new AuthService())->logout();
        return redirect()->to('/login');
    }
}
